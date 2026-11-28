from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, lazyload

from ..db import get_db
from ..deps import admin_only, current_user, default_warehouse
from ..models import Product, Purchase, PurchaseItem, Supplier, User, utcnow
from ..schemas import Page, PurchaseIn, PurchaseOut, PurchaseItemOut
from ..services.audit import audit
from ..services.stock import change_stock

router = APIRouter(prefix="/purchases", tags=["purchases"])


def _out(p: Purchase) -> PurchaseOut:
    return PurchaseOut(
        id=p.id, supplier_id=p.supplier_id, supplier_name=p.supplier.name, status=p.status,
        order_date=p.order_date, received_at=p.received_at, total_cost=p.total_cost, notes=p.notes,
        items=[PurchaseItemOut(id=i.id, product_id=i.product_id, sku=i.product.sku,
                               product_name=i.product.name, quantity=i.quantity, unit_cost=i.unit_cost)
               for i in p.items])


def _get(db: Session, user: User, pid: int, lock: bool = False) -> Purchase:
    q = select(Purchase).where(Purchase.id == pid, Purchase.business_id == user.business_id)
    if lock:
        # PostgreSQL rejects FOR UPDATE on the nullable side of the joined
        # eager load for Purchase.supplier. Defer that relationship and lock
        # only the purchase row on both engines.
        q = q.options(lazyload(Purchase.supplier)).with_for_update(of=Purchase)
    p = db.scalar(q)
    if not p:
        raise HTTPException(404, "Purchase not found")
    return p


def _apply_receipt(db: Session, user: User, p: Purchase) -> None:
    """Whole receipt is one transaction: caller commits only after every line succeeded."""
    for item in sorted(p.items, key=lambda i: i.product_id):  # stable lock order
        change_stock(db, user=user, product=item.product, warehouse_id=p.warehouse_id,
                     delta=item.quantity, movement_type="purchase_receipt",
                     reference_type="purchase", reference_id=p.id)
    p.status = "received"
    p.received_at = utcnow()


@router.post("", response_model=PurchaseOut, status_code=201)
def create_purchase(body: PurchaseIn, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    sup = db.get(Supplier, body.supplier_id)
    if not sup or sup.business_id != user.business_id or not sup.is_active:
        raise HTTPException(422, "Unknown or inactive supplier")
    wh = default_warehouse(db, user.business_id)
    purchase = Purchase(business_id=user.business_id, supplier_id=sup.id, warehouse_id=wh.id,
                        status="draft", notes=body.notes, created_by=user.id)
    total = 0
    for line in body.items:
        prod = db.get(Product, line.product_id)
        if not prod or prod.business_id != user.business_id or not prod.is_active:
            raise HTTPException(422, f"Unknown or inactive product {line.product_id}")
        purchase.items.append(PurchaseItem(product_id=prod.id, quantity=line.quantity, unit_cost=line.unit_cost))
        total += line.quantity * line.unit_cost
    purchase.total_cost = total
    db.add(purchase)
    db.flush()
    audit(db, user, "purchase.create", "purchase", purchase.id)
    if body.receive_now:
        _apply_receipt(db, user, purchase)
        audit(db, user, "purchase.receive", "purchase", purchase.id)
    db.commit()
    db.refresh(purchase)
    return _out(purchase)


@router.get("", response_model=Page[PurchaseOut])
def list_purchases(status: str | None = None, supplier_id: int | None = None,
                   limit: int = Query(25, ge=1, le=200), offset: int = Query(0, ge=0),
                   db: Session = Depends(get_db), user: User = Depends(current_user)):
    cond = [Purchase.business_id == user.business_id]
    if status:
        cond.append(Purchase.status == status)
    if supplier_id:
        cond.append(Purchase.supplier_id == supplier_id)
    total = db.scalar(select(func.count()).select_from(Purchase).where(*cond))
    rows = db.scalars(select(Purchase).where(*cond).order_by(Purchase.order_date.desc(), Purchase.id.desc())
                      .limit(limit).offset(offset)).unique().all()
    return Page(items=[_out(p) for p in rows], total=total, limit=limit, offset=offset)


@router.get("/{purchase_id}", response_model=PurchaseOut)
def get_purchase(purchase_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _out(_get(db, user, purchase_id))


@router.post("/{purchase_id}/receive", response_model=PurchaseOut)
def receive_purchase(purchase_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = _get(db, user, purchase_id, lock=True)  # row lock prevents double receipt
    if p.status != "draft":
        raise HTTPException(409, f"Purchase is already {p.status}")
    _apply_receipt(db, user, p)
    audit(db, user, "purchase.receive", "purchase", p.id)
    db.commit()
    db.refresh(p)
    return _out(p)


@router.post("/{purchase_id}/cancel", response_model=PurchaseOut)
def cancel_purchase(purchase_id: int, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    p = _get(db, user, purchase_id, lock=True)
    if p.status == "cancelled":
        raise HTTPException(409, "Purchase already cancelled")
    if p.status == "received":  # reversal entries; fails if the stock has already been sold
        for item in sorted(p.items, key=lambda i: i.product_id):
            change_stock(db, user=user, product=item.product, warehouse_id=p.warehouse_id,
                         delta=-item.quantity, movement_type="purchase_reversal",
                         reference_type="purchase", reference_id=p.id, reason="Purchase cancelled")
    p.status = "cancelled"
    audit(db, user, "purchase.cancel", "purchase", p.id)
    db.commit()
    db.refresh(p)
    return _out(p)
