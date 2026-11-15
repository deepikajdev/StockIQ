from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import admin_only, current_user, default_warehouse
from ..models import Inventory, Product, StockMovement, User, Warehouse, Category
from ..schemas import AdjustmentIn, InventoryOut, MovementOut, Page
from ..services.audit import audit
from ..services.stock import change_stock

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _movement_out(m: StockMovement) -> MovementOut:
    return MovementOut(id=m.id, created_at=m.created_at, product_id=m.product_id, sku=m.product.sku,
                       product_name=m.product.name, movement_type=m.movement_type,
                       quantity_change=m.quantity_change, quantity_before=m.quantity_before,
                       quantity_after=m.quantity_after, reference_type=m.reference_type,
                       reference_id=m.reference_id, reason=m.reason, user_name=m.user.full_name)


@router.get("", response_model=Page[InventoryOut])
def list_inventory(q: str | None = None, category_id: int | None = None, active: bool | None = True,
                   low_stock: bool = False,
                   limit: int = Query(25, ge=1, le=200), offset: int = Query(0, ge=0),
                   db: Session = Depends(get_db), user: User = Depends(current_user)):
    wh = default_warehouse(db, user.business_id)
    qty = func.coalesce(Inventory.quantity, 0)
    base = (select(Product, qty.label("qty"))
            .outerjoin(Inventory, (Inventory.product_id == Product.id) & (Inventory.warehouse_id == wh.id))
            .where(Product.business_id == user.business_id))
    if q:
        like = f"%{q.strip()}%"
        base = base.where(or_(Product.name.like(like), Product.sku.like(like)))
    if category_id:
        base = base.where(Product.category_id == category_id)
    if active is not None:
        base = base.where(Product.is_active.is_(active))
    if low_stock:
        base = base.where(qty <= Product.reorder_point)
    total = db.scalar(select(func.count()).select_from(base.subquery()))
    rows = db.execute(base.order_by(Product.name).limit(limit).offset(offset)).all()
    items = [InventoryOut(product_id=p.id, sku=p.sku, name=p.name,
                          category_name=p.category.name if p.category else None, unit=p.unit,
                          warehouse_id=wh.id, warehouse_name=wh.name, quantity=int(n),
                          cost_price=p.cost_price, stock_value=p.cost_price * int(n),
                          reorder_point=p.reorder_point, is_active=p.is_active) for p, n in rows]
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post("/adjustments", response_model=MovementOut, status_code=201)
def adjust_stock(body: AdjustmentIn, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    prod = db.get(Product, body.product_id)
    if not prod or prod.business_id != user.business_id:
        raise HTTPException(404, "Product not found")
    if body.quantity_change == 0:
        raise HTTPException(422, "quantity_change must be non-zero")
    if body.reason == "opening_balance" and body.quantity_change < 0:
        raise HTTPException(422, "Opening balance must be positive")
    wh = default_warehouse(db, user.business_id)
    reason = body.reason + (f": {body.note}" if body.note else "")
    mv = change_stock(db, user=user, product=prod, warehouse_id=wh.id, delta=body.quantity_change,
                      movement_type="adjustment", reference_type="adjustment", reason=reason)
    audit(db, user, "stock.adjust", "product", prod.id,
          {"change": body.quantity_change, "reason": body.reason})
    db.commit()
    db.refresh(mv)
    return _movement_out(mv)


@router.get("/movements", response_model=Page[MovementOut])
def list_movements(product_id: int | None = None, movement_type: str | None = None,
                   date_from: date | None = None, date_to: date | None = None,
                   limit: int = Query(25, ge=1, le=200), offset: int = Query(0, ge=0),
                   db: Session = Depends(get_db), user: User = Depends(current_user)):
    cond = [StockMovement.business_id == user.business_id]
    if product_id:
        cond.append(StockMovement.product_id == product_id)
    if movement_type:
        cond.append(StockMovement.movement_type == movement_type)
    if date_from:
        cond.append(StockMovement.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        cond.append(StockMovement.created_at < datetime.combine(date_to + timedelta(days=1), time.min))
    total = db.scalar(select(func.count()).select_from(StockMovement).where(*cond))
    rows = db.scalars(select(StockMovement).where(*cond)
                      .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
                      .limit(limit).offset(offset)).unique().all()
    return Page(items=[_movement_out(m) for m in rows], total=total, limit=limit, offset=offset)
