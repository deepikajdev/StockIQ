"""The ONE path through which stock changes.

Callers own the transaction (commit/rollback). This function locks the inventory row
(SELECT ... FOR UPDATE), enforces non-negative stock, updates the balance and appends the
ledger row, so concurrent sales cannot oversell.
"""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Inventory, Product, StockMovement, User


class InsufficientStock(HTTPException):
    def __init__(self, product: Product, available: int, requested: int):
        super().__init__(409, detail={
            "code": "insufficient_stock",
            "message": f"Insufficient stock for {product.sku} ({product.name}): "
                       f"available {available}, requested {requested}",
            "product_id": product.id, "available": available, "requested": requested,
        })


def _locked_inventory(db: Session, product_id: int, warehouse_id: int) -> Inventory:
    q = (select(Inventory)
         .where(Inventory.product_id == product_id, Inventory.warehouse_id == warehouse_id)
         .with_for_update())
    inv = db.scalar(q)
    if inv is None:
        try:
            with db.begin_nested():
                db.add(Inventory(product_id=product_id, warehouse_id=warehouse_id, quantity=0))
        except IntegrityError:  # another request created it first
            pass
        inv = db.scalar(q)
    return inv


def change_stock(db: Session, *, user: User, product: Product, warehouse_id: int, delta: int,
                 movement_type: str, reference_type: str | None = None,
                 reference_id: int | None = None, reason: str | None = None) -> StockMovement:
    if delta == 0:
        raise HTTPException(422, "Stock change must be non-zero")
    inv = _locked_inventory(db, product.id, warehouse_id)
    before, after = inv.quantity, inv.quantity + delta
    if after < 0:
        raise InsufficientStock(product, before, -delta)
    inv.quantity = after
    mv = StockMovement(
        business_id=user.business_id, product_id=product.id, warehouse_id=warehouse_id,
        movement_type=movement_type, quantity_change=delta, quantity_before=before,
        quantity_after=after, reference_type=reference_type, reference_id=reference_id,
        reason=reason, user_id=user.id,
    )
    db.add(mv)
    db.flush()
    return mv
