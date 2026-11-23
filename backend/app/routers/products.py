from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import admin_only, current_user
from ..models import Category, Inventory, Product, ProductSupplier, Supplier, User
from ..schemas import (CategoryIn, CategoryOut, Page, ProductIn, ProductOut, ProductSupplierIn,
                       ProductSupplierOut, ProductUpdate)
from ..services.audit import audit

router = APIRouter(tags=["products"])


def _out(p: Product, stock: int) -> ProductOut:
    return ProductOut(
        id=p.id, sku=p.sku, name=p.name, category_id=p.category_id,
        category_name=p.category.name if p.category else None, unit=p.unit,
        selling_price=p.selling_price, cost_price=p.cost_price, reorder_point=p.reorder_point,
        safety_stock=p.safety_stock, is_active=p.is_active, stock_on_hand=int(stock or 0))


def _get_product(db: Session, user: User, product_id: int) -> Product:
    p = db.get(Product, product_id)
    if not p or p.business_id != user.business_id:
        raise HTTPException(404, "Product not found")
    return p


def _check_category(db: Session, user: User, category_id: int | None):
    if category_id is not None:
        c = db.get(Category, category_id)
        if not c or c.business_id != user.business_id:
            raise HTTPException(422, "Unknown category")


def _stock(db: Session, product_id: int) -> int:
    return db.scalar(select(func.coalesce(func.sum(Inventory.quantity), 0))
                     .where(Inventory.product_id == product_id)) or 0


# ---- categories
@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(select(Category).where(Category.business_id == user.business_id)
                      .order_by(Category.name)).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryIn, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    c = Category(business_id=user.business_id, name=body.name.strip())
    db.add(c)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Category already exists")
    audit(db, user, "category.create", "category", c.id)
    db.commit()
    return c


# ---- products
@router.get("/products", response_model=Page[ProductOut])
def list_products(
    q: str | None = None, category_id: int | None = None, active: bool | None = None,
    limit: int = Query(25, ge=1, le=200), offset: int = Query(0, ge=0),
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    stock_sq = (select(Inventory.product_id, func.sum(Inventory.quantity).label("qty"))
                .group_by(Inventory.product_id).subquery())
    cond = [Product.business_id == user.business_id]
    if q:
        like = f"%{q.strip()}%"
        cond.append(or_(Product.name.like(like), Product.sku.like(like)))
    if category_id:
        cond.append(Product.category_id == category_id)
    if active is not None:
        cond.append(Product.is_active.is_(active))
    total = db.scalar(select(func.count()).select_from(Product).where(*cond))
    rows = db.execute(
        select(Product, stock_sq.c.qty).outerjoin(stock_sq, stock_sq.c.product_id == Product.id)
        .where(*cond).order_by(Product.name).limit(limit).offset(offset)).all()
    return Page(items=[_out(p, qty) for p, qty in rows], total=total, limit=limit, offset=offset)


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(body: ProductIn, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    _check_category(db, user, body.category_id)
    p = Product(business_id=user.business_id, **{**body.model_dump(), "sku": body.sku.strip()})
    db.add(p)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "SKU already exists")
    audit(db, user, "product.create", "product", p.id, {"sku": p.sku})
    db.commit()
    db.refresh(p)
    return _out(p, 0)


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = _get_product(db, user, product_id)
    return _out(p, _stock(db, p.id))


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db),
                   user: User = Depends(admin_only)):
    p = _get_product(db, user, product_id)
    data = body.model_dump(exclude_unset=True)
    if "category_id" in data:
        _check_category(db, user, data["category_id"])
    for k, v in data.items():
        setattr(p, k, v)
    audit(db, user, "product.update", "product", p.id, {k: str(v) for k, v in data.items()})
    db.commit()
    db.refresh(p)
    return _out(p, _stock(db, p.id))


@router.delete("/products/{product_id}", response_model=ProductOut)
def deactivate_product(product_id: int, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    """Soft delete: products with history are never removed."""
    p = _get_product(db, user, product_id)
    p.is_active = False
    audit(db, user, "product.deactivate", "product", p.id)
    db.commit()
    return _out(p, _stock(db, p.id))


# ---- supplier mapping
def _ps_out(ps: ProductSupplier) -> ProductSupplierOut:
    return ProductSupplierOut(id=ps.id, product_id=ps.product_id, supplier_id=ps.supplier_id,
                              supplier_name=ps.supplier.name, unit_cost=ps.unit_cost,
                              lead_time_days=ps.lead_time_days, min_order_qty=ps.min_order_qty,
                              is_preferred=ps.is_preferred)


@router.get("/products/{product_id}/suppliers", response_model=list[ProductSupplierOut])
def product_suppliers(product_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    _get_product(db, user, product_id)
    return [_ps_out(x) for x in db.scalars(select(ProductSupplier).where(ProductSupplier.product_id == product_id))]


@router.put("/products/{product_id}/suppliers", response_model=ProductSupplierOut)
def upsert_product_supplier(product_id: int, body: ProductSupplierIn, db: Session = Depends(get_db),
                            user: User = Depends(admin_only)):
    _get_product(db, user, product_id)
    s = db.get(Supplier, body.supplier_id)
    if not s or s.business_id != user.business_id:
        raise HTTPException(422, "Unknown supplier")
    ps = db.scalar(select(ProductSupplier).where(ProductSupplier.product_id == product_id,
                                                 ProductSupplier.supplier_id == body.supplier_id))
    if body.is_preferred:  # only one preferred supplier per product
        for other in db.scalars(select(ProductSupplier).where(ProductSupplier.product_id == product_id)):
            other.is_preferred = False
    if ps is None:
        ps = ProductSupplier(product_id=product_id, **body.model_dump())
        db.add(ps)
    else:
        for k, v in body.model_dump().items():
            setattr(ps, k, v)
    db.flush()
    audit(db, user, "product_supplier.upsert", "product", product_id, {"supplier_id": body.supplier_id})
    db.commit()
    db.refresh(ps)
    return _ps_out(ps)


@router.delete("/products/{product_id}/suppliers/{supplier_id}", status_code=204)
def unlink_product_supplier(product_id: int, supplier_id: int, db: Session = Depends(get_db),
                            user: User = Depends(admin_only)):
    _get_product(db, user, product_id)
    ps = db.scalar(select(ProductSupplier).where(ProductSupplier.product_id == product_id,
                                                 ProductSupplier.supplier_id == supplier_id))
    if not ps:
        raise HTTPException(404, "Link not found")
    db.delete(ps)
    audit(db, user, "product_supplier.delete", "product", product_id, {"supplier_id": supplier_id})
    db.commit()
