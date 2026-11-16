"""Seed script for StockIQ demo stationery shop.

Requirements:
- 8 categories
- 40 products with realistic prices/costs
- 6 suppliers with product links (some unknown lead time / MOQ left NULL)
- Opening balances
- 6 purchases received over the last 8 weeks
- ~8 weeks of daily sales with realistic variation
- Every stock change goes through change_stock so ledger == inventory.
- Backdates sold_at, order_date, received_at, and stock_movement.created_at.
- Idempotent: refuses to run if products already exist unless --reset is passed.
"""

import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import random

# Ensure backend/ is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import delete, func, select, text
from app.db import SessionLocal
from app import models
from app.services.stock import change_stock
from scripts.bootstrap import run as bootstrap


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def run_seed(reset: bool = False):
    # Ensure tables and initial admin/staff users exist
    bootstrap()

    with SessionLocal() as db:
        # Permit ledger backdating and reset purges within seed session
        try:
            db.execute(text("SET @STOCKIQ_ALLOW_LEDGER_MUTATION = 1"))
        except Exception:
            pass
        prod_count = db.scalar(select(func.count(models.Product.id)))
        if prod_count > 0:
            if not reset:
                print(f"[!] Database already contains {prod_count} products.")
                print("    Refusing to seed. Run with --reset to wipe and re-seed.")
                return
            print("[*] --reset passed. Cleaning up existing transactional and catalog data...")
            # Delete in child-to-parent order to respect foreign keys
            db.execute(delete(models.SaleItem))
            db.execute(delete(models.Sale))
            db.execute(delete(models.PurchaseItem))
            db.execute(delete(models.Purchase))
            db.execute(delete(models.StockMovement))
            db.execute(delete(models.Inventory))
            db.execute(delete(models.ProductSupplier))
            db.execute(delete(models.Product))
            db.execute(delete(models.Category))
            db.execute(delete(models.Supplier))
            db.execute(delete(models.AuditLog))
            db.commit()
            print("[+] Database cleaned successfully.")


if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    run_seed(reset=reset_flag)
