from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import admin_only, current_user
from ..models import Product, ProductSupplier, Supplier, User
from ..schemas import Page, SupplierIn, SupplierOut, SupplierUpdate
from ..services.audit import audit

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


def _get(db: Session, user: User, sid: int) -> Supplier:
    s = db.get(Supplier, sid)
    if not s or s.business_id != user.business_id:
        raise HTTPException(404, "Supplier not found")
    return s


@router.get("", response_model=Page[SupplierOut])
def list_suppliers(q: str | None = None, active: bool | None = None,
                   limit: int = Query(25, ge=1, le=200), offset: int = Query(0, ge=0),
                   db: Session = Depends(get_db), user: User = Depends(current_user)):
    cond = [Supplier.business_id == user.business_id]
    if q:
        cond.append(Supplier.name.like(f"%{q.strip()}%"))
    if active is not None:
        cond.append(Supplier.is_active.is_(active))
    total = db.scalar(select(func.count()).select_from(Supplier).where(*cond))
    rows = db.scalars(select(Supplier).where(*cond).order_by(Supplier.name).limit(limit).offset(offset)).all()
    return Page(items=rows, total=total, limit=limit, offset=offset)


@router.post("", response_model=SupplierOut, status_code=201)
def create_supplier(body: SupplierIn, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    s = Supplier(business_id=user.business_id, **body.model_dump())
    db.add(s)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Supplier name already exists")
    audit(db, user, "supplier.create", "supplier", s.id)
    db.commit()
    return s


@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier(supplier_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _get(db, user, supplier_id)


@router.patch("/{supplier_id}", response_model=SupplierOut)
def update_supplier(supplier_id: int, body: SupplierUpdate, db: Session = Depends(get_db),
                    user: User = Depends(admin_only)):
    s = _get(db, user, supplier_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    audit(db, user, "supplier.update", "supplier", s.id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Supplier name already exists")
    return s


@router.get("/{supplier_id}/products")
def supplier_products(supplier_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    _get(db, user, supplier_id)
    rows = db.execute(select(Product, ProductSupplier).join(ProductSupplier, ProductSupplier.product_id == Product.id)
                      .where(ProductSupplier.supplier_id == supplier_id).order_by(Product.name)).all()
    return [{"product_id": p.id, "sku": p.sku, "name": p.name, "unit_cost": ps.unit_cost,
             "lead_time_days": ps.lead_time_days, "min_order_qty": ps.min_order_qty,
             "is_preferred": ps.is_preferred} for p, ps in rows]
