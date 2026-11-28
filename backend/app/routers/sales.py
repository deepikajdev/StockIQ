from collections import defaultdict
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import admin_only, current_user, default_warehouse
from ..models import Product, Sale, SaleItem, User
from ..schemas import Page, SaleIn, SaleItemOut, SaleOut
from ..services.audit import audit
from ..services.stock import change_stock

router = APIRouter(prefix="/sales", tags=["sales"])


def _out(s: Sale) -> SaleOut:
    return SaleOut(
        id=s.id, status=s.status, sold_at=s.sold_at, customer_name=s.customer_name,
        total_amount=s.total_amount,
        items=[SaleItemOut(id=i.id, product_id=i.product_id, sku=i.product.sku,
                           product_name=i.product.name, quantity=i.quantity, unit_price=i.unit_price)
               for i in s.items])


@router.post("", response_model=SaleOut, status_code=201)
def create_sale(body: SaleIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Sale + items + stock deductions + ledger rows commit together or not at all."""
    wh = default_warehouse(db, user.business_id)
    qty_by_product: dict[int, int] = defaultdict(int)
    for line in body.items:
        qty_by_product[line.product_id] += line.quantity

    sale = Sale(business_id=user.business_id, warehouse_id=wh.id, status="completed",
                customer_name=body.customer_name, created_by=user.id)
    db.add(sale)
    db.flush()
    total = 0
    for pid in sorted(qty_by_product):  # consistent lock order avoids deadlocks
        prod = db.get(Product, pid)
        if not prod or prod.business_id != user.business_id or not prod.is_active:
            raise HTTPException(422, f"Unknown or inactive product {pid}")
        qty = qty_by_product[pid]
        change_stock(db, user=user, product=prod, warehouse_id=wh.id, delta=-qty,
                     movement_type="sale", reference_type="sale", reference_id=sale.id)
        sale.items.append(SaleItem(product_id=pid, quantity=qty, unit_price=prod.selling_price,
                                   unit_cost=prod.cost_price))
        total += qty * prod.selling_price
    sale.total_amount = total
    audit(db, user, "sale.create", "sale", sale.id, {"total": str(total)})
    db.commit()  # any exception above => nothing committed (session closes with rollback)
    db.refresh(sale)
    return _out(sale)


@router.get("", response_model=Page[SaleOut])
def list_sales(date_from: date | None = None, date_to: date | None = None, status: str | None = None,
               limit: int = Query(25, ge=1, le=200), offset: int = Query(0, ge=0),
               db: Session = Depends(get_db), user: User = Depends(current_user)):
    cond = [Sale.business_id == user.business_id]
    if date_from:
        cond.append(Sale.sold_at >= datetime.combine(date_from, time.min))
    if date_to:
        cond.append(Sale.sold_at < datetime.combine(date_to + timedelta(days=1), time.min))
    if status:
        cond.append(Sale.status == status)
    total = db.scalar(select(func.count()).select_from(Sale).where(*cond))
    rows = db.scalars(select(Sale).where(*cond).order_by(Sale.sold_at.desc(), Sale.id.desc())
                      .limit(limit).offset(offset)).unique().all()
    return Page(items=[_out(s) for s in rows], total=total, limit=limit, offset=offset)


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    s = db.get(Sale, sale_id)
    if not s or s.business_id != user.business_id:
        raise HTTPException(404, "Sale not found")
    return _out(s)


@router.post("/{sale_id}/cancel", response_model=SaleOut)
def cancel_sale(sale_id: int, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    s = db.scalar(select(Sale).where(Sale.id == sale_id, Sale.business_id == user.business_id).with_for_update(of=Sale))
    if not s:
        raise HTTPException(404, "Sale not found")
    if s.status == "cancelled":
        raise HTTPException(409, "Sale already cancelled")
    for item in sorted(s.items, key=lambda i: i.product_id):
        change_stock(db, user=user, product=item.product, warehouse_id=s.warehouse_id, delta=item.quantity,
                     movement_type="sale_reversal", reference_type="sale", reference_id=s.id,
                     reason="Sale cancelled")
    s.status = "cancelled"
    audit(db, user, "sale.cancel", "sale", s.id)
    db.commit()
    db.refresh(s)
    return _out(s)
