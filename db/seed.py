"""Seed script for StockIQ demo stationery shop.

Requirements:
- 8 categories
- 40 products with realistic prices/costs
- 6 suppliers with product links (some unknown lead time / MOQ left NULL)
- Opening balances
- 6 purchases received over the last 8 weeks
- ~8 weeks of daily sales with realistic variation:
  - Fast movers and slow movers
  - 3-4 products deliberately near/below reorder point
  - 2 products with zero sales in 60 days
  - 1 product with <7 days of history
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


CATEGORIES_DATA = [
    "Writing Instruments",
    "Notebooks & Notepads",
    "Paper & Envelopes",
    "Filing & Folders",
    "Desk Accessories",
    "Adhesives & Tapes",
    "Art & Craft Supplies",
    "Mailing & Shipping",
]

SUPPLIERS_DATA = [
    {
        "name": "Apex Office Wholesale",
        "contact_name": "Marcus Vance",
        "email": "orders@apexoffice.example.com",
        "phone": "+1-555-0192",
        "address": "100 Industrial Parkway, Sector 4, Chicago, IL",
    },
    {
        "name": "Meridian Paper & Packaging Co",
        "contact_name": "Elena Rostova",
        "email": "supply@meridianpaper.example.com",
        "phone": "+1-555-0144",
        "address": "45 Millstream Road, Green Bay, WI",
    },
    {
        "name": "Prism Art & Writing Instruments",
        "contact_name": "Julian Chen",
        "email": "b2b@prismart.example.com",
        "phone": "+1-555-0188",
        "address": "88 Creative Way, Portland, OR",
    },
    {
        "name": "Global Desk Essentials Corp",
        "contact_name": "Sarah Jenkins",
        "email": "sales@globaldesk.example.com",
        "phone": "+1-555-0112",
        "address": "742 Commerce Blvd, Dallas, TX",
    },
    {
        "name": "Reliant Shipping Supplies",
        "contact_name": "Tom Gallagher",
        "email": "distro@reliantship.example.com",
        "phone": "+1-555-0167",
        "address": "310 Logistics Court, Atlanta, GA",
    },
    {
        "name": "Beacon Stationery Wholesale",
        "contact_name": "Amira Patel",
        "email": "wholesale@beaconstat.example.com",
        "phone": "+1-555-0131",
        "address": "52 Harbor Road, Boston, MA",
    },
]

# 40 products: (category_name, sku, name, unit, cost_price, selling_price, reorder_point, safety_stock, supplier_idx, lead_time, moq)
# Some lead_time and moq are deliberately None (unknown)
PRODUCTS_DATA = [
    # Writing Instruments (1-5)
    ("Writing Instruments", "PEN-BALL-BLU", "Ballpoint Pens Medium Blue (Box of 10)", "box", "2.40", "4.99", 15, 5, 0, 5, 20),
    ("Writing Instruments", "PEN-BALL-BLK", "Ballpoint Pens Medium Black (Box of 10)", "box", "2.40", "4.99", 15, 5, 0, 5, 20),
    ("Writing Instruments", "PEN-GEL-05", "Gel Ink Pens Black 0.5mm (Pack of 5)", "pack", "3.20", "6.50", 20, 10, 2, 7, 15),
    ("Writing Instruments", "PEN-FINELIN-6", "Fineliner Micro Technical Pens (Set of 6)", "set", "6.50", "13.99", 10, 5, 2, None, None), # unknown lead & moq
    ("Writing Instruments", "PNC-HB-WOOD", "Classic HB Graphite Pencils (Box of 12)", "box", "1.80", "3.99", 12, 5, 5, 4, 25),
    ("Writing Instruments", "PNC-MECH-07", "Retractable Mechanical Pencil 0.7mm", "pcs", "1.50", "3.49", 15, 5, 2, 6, None),
    ("Writing Instruments", "MRK-HLT-PAST", "Pastel Chisel Highlighters (Pack of 4)", "pack", "2.80", "5.99", 18, 8, 2, 5, 10),
    ("Writing Instruments", "MRK-WBD-4AST", "Dry-Erase Whiteboard Markers (Assorted 4)", "pack", "3.50", "7.25", 14, 6, 0, None, 10),

    # Notebooks & Notepads (6-13)
    ("Notebooks & Notepads", "NB-JRN-A5-HRD", "Hardcover Ruled Journal A5 192pg", "pcs", "4.20", "8.99", 12, 5, 5, 8, 10),
    ("Notebooks & Notepads", "NB-SPR-B5-COL", "Spiral College Ruled Notebook B5", "pcs", "2.10", "4.50", 20, 8, 1, 5, 30),
    ("Notebooks & Notepads", "NB-GRP-A4-WIRE", "Wirebound Quad-Ruled Graph Notebook A4", "pcs", "2.60", "5.50", 15, 5, 1, 7, 20),
    ("Notebooks & Notepads", "PAD-STK-3X3-YLW", "Sticky Notes Canary Yellow 3x3in (Pack of 6)", "pack", "2.75", "5.75", 25, 10, 0, 4, 24),
    ("Notebooks & Notepads", "PAD-MEMO-PKT-3", "Pocket Memo Ruled Pads (Pack of 3)", "pack", "1.60", "3.50", 15, 5, 5, None, None),
    ("Notebooks & Notepads", "PAD-LGL-LTR-3", "Perforated Legal Pads Letter Size (Pack of 3)", "pack", "3.40", "6.99", 15, 5, 1, 5, 15),
    ("Notebooks & Notepads", "NB-DOT-A5-BUL", "Bullet Dot Grid Journal A5 160gsm", "pcs", "5.80", "12.50", 10, 4, 2, 10, 10),
    ("Notebooks & Notepads", "NB-EXEC-LTH-A5", "Executive Leatherette Bound Notebook", "pcs", "7.50", "16.99", 8, 3, 5, None, 5), # ZERO sales in 60d

    # Paper & Envelopes (14-18)
    ("Paper & Envelopes", "PPR-CPY-A4-80", "Multi-Use Copy Paper 80gsm A4 (500 Sheets)", "ream", "3.80", "7.50", 30, 15, 1, 3, 50),
    ("Paper & Envelopes", "PPR-REC-A4-75", "100% Recycled Copy Paper 75gsm A4 (500 Sheets)", "ream", "4.10", "8.25", 20, 10, 1, 5, 40),
    ("Paper & Envelopes", "PPR-CRD-A4-WHT", "Heavyweight Cardstock Paper 210gsm (50 Sheets)", "pack", "3.20", "6.75", 12, 5, 1, 7, 15),
    ("Paper & Envelopes", "ENV-KRFT-C5-50", "Brown Kraft Gummed Envelopes C5 (Pack of 50)", "pack", "2.50", "5.25", 15, 5, 1, 6, 20),
    ("Paper & Envelopes", "ENV-SEC-10-100", "Security Tint Self-Seal Envelopes #10 (Box of 100)", "box", "4.20", "8.75", 16, 6, 0, 5, 15),

    # Filing & Folders (19-24)
    ("Filing & Folders", "FLD-MNL-LTR-50", "Heavy Duty Manila Folders Letter Size (Box of 50)", "box", "5.10", "10.99", 12, 5, 0, 5, 10),
    ("Filing & Folders", "FLD-EXP-13PKT", "Expanding File Folder 13-Pocket with Tab Inserts", "pcs", "4.80", "9.99", 8, 3, 3, 8, 10),
    ("Filing & Folders", "BND-2RNG-A4-25", "Poly D-Ring Binder 2-Ring 25mm A4 Black", "pcs", "2.40", "5.20", 18, 6, 3, 6, 20),
    ("Filing & Folders", "FLD-CLR-A4-10", "Clear Document Sleeves Wallets A4 (Pack of 10)", "pack", "1.30", "2.99", 25, 10, 3, 4, 30),
    ("Filing & Folders", "BND-LEV-75-BLU", "Lever Arch File Polypropylene 75mm Blue", "pcs", "3.60", "7.50", 15, 5, 0, 7, 15),
    ("Filing & Folders", "IDX-TAB-A4-12", "Mylar Reinforced Index Dividers 1-12 A4", "set", "1.50", "3.25", 20, 8, 5, None, None),

    # Desk Accessories (25-30)
    ("Desk Accessories", "DSK-STP-HVY-M1", "Heavy-Duty Desktop Metal Stapler", "pcs", "5.20", "11.50", 10, 4, 3, 7, 10),
    ("Desk Accessories", "DSK-STP-26-6", "Standard 26/6 Steel Staples (Box of 5000)", "box", "1.10", "2.50", 30, 10, 3, 4, 50),
    ("Desk Accessories", "DSK-PNC-2H-30", "Precision 2-Hole Punch 30-Sheet Capacity", "pcs", "4.60", "9.80", 8, 3, 3, 7, 10),
    ("Desk Accessories", "DSK-SCS-8IN-SS", "Stainless Steel Office Scissors 8-inch", "pcs", "2.30", "4.99", 15, 5, 3, 5, 20),
    ("Desk Accessories", "DSK-RLR-30-MTL", "Stainless Steel Non-Slip Ruler 30cm", "pcs", "1.20", "2.75", 15, 5, 3, None, 25),
    ("Desk Accessories", "DSK-ORG-CAD-ACR", "Clear Acrylic 4-Compartment Desk Pen Caddy", "pcs", "3.90", "8.50", 10, 4, 3, 8, 12),

    # Adhesives & Tapes (31-35)
    ("Adhesives & Tapes", "ADH-TP-CLR-48", "Clear Poly Packing Tape 48mm x 50m", "roll", "1.40", "3.10", 35, 15, 4, 4, 40),
    ("Adhesives & Tapes", "ADH-TP-DBL-18", "Double-Sided Craft Adhesive Tape 18mm x 25m", "roll", "1.80", "3.99", 20, 8, 4, 6, 20),
    ("Adhesives & Tapes", "ADH-GLU-STK-4", "Disappearing Purple Glue Sticks 21g (Pack of 4)", "pack", "2.10", "4.50", 25, 10, 0, 5, 25),
    ("Adhesives & Tapes", "ADH-GLU-ALL-120", "Multi-Surface All Purpose White Glue 120ml", "pcs", "1.25", "2.80", 18, 6, 5, 5, 20),
    ("Adhesives & Tapes", "ADH-DOT-RMV-300", "Removable Adhesive Glue Dots (Pack of 300)", "pack", "2.40", "5.25", 15, 5, 4, None, None),

    # Art & Craft Supplies (36-37)
    ("Art & Craft Supplies", "ART-WTR-24HP", "Artist Studio Watercolour Paint Set 24 Half Pans", "set", "9.50", "21.99", 6, 2, 2, 10, 5),
    ("Art & Craft Supplies", "ART-SKT-A3-PRO", "Professional Heavyweight Sketchbook A3 30 Sheets", "pcs", "6.20", "13.50", 8, 3, 2, 8, 8), # ZERO sales in 60d

    # Mailing & Shipping (38-40)
    ("Mailing & Shipping", "ML-BBL-M2-25", "Self-Seal Kraft Bubble Mailers #2 (Pack of 25)", "pack", "4.50", "9.75", 15, 5, 4, 4, 15),
    ("Mailing & Shipping", "ML-STR-FLM-15", "Cast Heavy Duty Stretch Wrap Film 15in x 1000ft", "roll", "8.20", "17.99", 10, 4, 4, 6, 8),
    ("Mailing & Shipping", "ML-TP-FRG-48", "High-Visibility Fragile Packaging Tape 48mm x 50m", "roll", "1.90", "4.25", 15, 5, 4, 5, 20), # <7 days history
]


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

        # Retrieve core business, default warehouse, and users
        biz = db.scalar(select(models.Business))
        wh = db.scalar(select(models.Warehouse).where(models.Warehouse.business_id == biz.id, models.Warehouse.is_default.is_(True)))
        admin_user = db.scalar(select(models.User).where(models.User.email == "admin@stockiq.example.com"))
        staff_user = db.scalar(select(models.User).where(models.User.email == "staff@stockiq.example.com")) or admin_user

        print("[*] Creating 8 categories...")
        categories_map = {}
        for cat_name in CATEGORIES_DATA:
            cat = models.Category(business_id=biz.id, name=cat_name)
            db.add(cat)
            db.flush()
            categories_map[cat_name] = cat

        print("[*] Creating 6 suppliers...")
        suppliers_list = []
        for s_data in SUPPLIERS_DATA:
            sup = models.Supplier(
                business_id=biz.id,
                name=s_data["name"],
                contact_name=s_data["contact_name"],
                email=s_data["email"],
                phone=s_data["phone"],
                address=s_data["address"],
                is_active=True,
                created_at=utcnow() - timedelta(days=90),
            )
            db.add(sup)
            db.flush()
            suppliers_list.append(sup)

        print("[*] Creating 40 products and supplier links...")
        products_map = {}
        now = utcnow()
        t_60d_ago = now - timedelta(days=60)
        t_5d_ago = now - timedelta(days=5)

        for cat_name, sku, name, unit, cost, price, reorder, safety, sup_idx, lead, moq in PRODUCTS_DATA:
            # The newest product has <7 days history
            is_newest = (sku == "ML-TP-FRG-48")
            prod_created = t_5d_ago if is_newest else t_60d_ago

            prod = models.Product(
                business_id=biz.id,
                category_id=categories_map[cat_name].id,
                sku=sku,
                name=name,
                unit=unit,
                cost_price=Decimal(cost),
                selling_price=Decimal(price),
                reorder_point=reorder,
                safety_stock=safety,
                is_active=True,
                created_at=prod_created,
                updated_at=prod_created,
            )
            db.add(prod)
            db.flush()
            products_map[sku] = prod

            # Preferred supplier link
            ps = models.ProductSupplier(
                product_id=prod.id,
                supplier_id=suppliers_list[sup_idx].id,
                unit_cost=Decimal(cost),
                lead_time_days=lead,
                min_order_qty=moq,
                is_preferred=True,
            )
            db.add(ps)

            # Add an alternate supplier for every 3rd product
            if (len(products_map) % 3) == 0:
                alt_idx = (sup_idx + 1) % len(suppliers_list)
                alt_lead = None if lead is None else lead + 2
                alt_ps = models.ProductSupplier(
                    product_id=prod.id,
                    supplier_id=suppliers_list[alt_idx].id,
                    unit_cost=Decimal(cost) * Decimal("1.05"),
                    lead_time_days=alt_lead,
                    min_order_qty=moq,
                    is_preferred=False,
                )
                db.add(alt_ps)

        db.flush()

        print("[*] Establishing opening balances via change_stock (backdated ~60 days)...")
        # Define base opening quantities
        opening_qty = {
            # Writing
            "PEN-BALL-BLU": 80,
            "PEN-BALL-BLK": 90,
            "PEN-GEL-05": 65,
            "PEN-FINELIN-6": 35,
            "PNC-HB-WOOD": 50,
            "PNC-MECH-07": 40,
            "MRK-HLT-PAST": 30,  # will end up near reorder
            "MRK-WBD-4AST": 45,
            # Notebooks
            "NB-JRN-A5-HRD": 45,
            "NB-SPR-B5-COL": 70,
            "NB-GRP-A4-WIRE": 55,
            "PAD-STK-3X3-YLW": 85,
            "PAD-MEMO-PKT-3": 40,
            "PAD-LGL-LTR-3": 45,
            "NB-DOT-A5-BUL": 30,
            "NB-EXEC-LTH-A5": 15, # zero sales
            # Paper
            "PPR-CPY-A4-80": 60,  # will end up near/below reorder
            "PPR-REC-A4-75": 50,
            "PPR-CRD-A4-WHT": 35,
            "ENV-KRFT-C5-50": 40,
            "ENV-SEC-10-100": 45,
            # Filing
            "FLD-MNL-LTR-50": 35,
            "FLD-EXP-13PKT": 25,
            "BND-2RNG-A4-25": 45,
            "FLD-CLR-A4-10": 80,
            "BND-LEV-75-BLU": 35,
            "IDX-TAB-A4-12": 50,
            # Desk
            "DSK-STP-HVY-M1": 18, # will end up below reorder
            "DSK-STP-26-6": 75,
            "DSK-PNC-2H-30": 20,
            "DSK-SCS-8IN-SS": 35,
            "DSK-RLR-30-MTL": 40,
            "DSK-ORG-CAD-ACR": 25,
            # Adhesives
            "ADH-TP-CLR-48": 80,
            "ADH-TP-DBL-18": 45,
            "ADH-GLU-STK-4": 60,
            "ADH-GLU-ALL-120": 40,
            "ADH-DOT-RMV-300": 35,
            # Art
            "ART-WTR-24HP": 20,
            "ART-SKT-A3-PRO": 16, # zero sales
            # Shipping
            "ML-BBL-M2-25": 45,
            "ML-STR-FLM-15": 25,
            "ML-TP-FRG-48": 30,   # created 5d ago
        }

        for sku, prod in products_map.items():
            qty = opening_qty.get(sku, 30)
            created_ts = t_5d_ago if sku == "ML-TP-FRG-48" else (now - timedelta(days=58))
            mv = change_stock(
                db,
                user=admin_user,
                product=prod,
                warehouse_id=wh.id,
                delta=qty,
                movement_type="adjustment",
                reference_type="adjustment",
                reason="opening_balance",
            )
            mv.created_at = created_ts

        db.flush()

        print("[*] Generating 6 received purchases over the last 8 weeks...")
        # 6 purchases scheduled across weeks: -7, -6, -4, -3, -2, -1
        purchases_schedule = [
            (50, 48, 0, [("PEN-BALL-BLU", 50), ("PEN-BALL-BLK", 50), ("PAD-STK-3X3-YLW", 40)]),
            (42, 40, 1, [("PPR-CPY-A4-80", 40), ("PPR-REC-A4-75", 30), ("ENV-SEC-10-100", 25)]),
            (30, 27, 2, [("PEN-GEL-05", 40), ("PEN-FINELIN-6", 20), ("NB-DOT-A5-BUL", 20)]),
            (21, 19, 3, [("DSK-STP-26-6", 50), ("FLD-CLR-A4-10", 40), ("BND-2RNG-A4-25", 30)]),
            (14, 12, 4, [("ADH-TP-CLR-48", 50), ("ML-BBL-M2-25", 30), ("ML-STR-FLM-15", 20)]),
            (7, 5, 0, [("PEN-BALL-BLU", 30), ("FLD-MNL-LTR-50", 20), ("ADH-GLU-STK-4", 30)]),
        ]

        for order_days, recv_days, sup_i, items_spec in purchases_schedule:
            order_dt = now - timedelta(days=order_days)
            recv_dt = now - timedelta(days=recv_days)
            sup = suppliers_list[sup_i]

            purch = models.Purchase(
                business_id=biz.id,
                supplier_id=sup.id,
                warehouse_id=wh.id,
                status="received",
                order_date=order_dt,
                received_at=recv_dt,
                total_cost=Decimal("0.00"),
                notes=f"Stock replenishment order #{order_days}d ago",
                created_by=admin_user.id,
            )
            db.add(purch)
            db.flush()

            purch_total = Decimal("0.00")
            for p_sku, p_qty in items_spec:
                prod = products_map[p_sku]
                cost = prod.cost_price
                purch_item = models.PurchaseItem(
                    purchase_id=purch.id,
                    product_id=prod.id,
                    quantity=p_qty,
                    unit_cost=cost,
                )
                purch.items.append(purch_item)
                purch_total += Decimal(p_qty) * cost

                mv = change_stock(
                    db,
                    user=admin_user,
                    product=prod,
                    warehouse_id=wh.id,
                    delta=p_qty,
                    movement_type="purchase_receipt",
                    reference_type="purchase",
                    reference_id=purch.id,
                )
                mv.created_at = recv_dt

            purch.total_cost = purch_total
            db.flush()

        print("[*] Generating ~8 weeks of daily sales with realistic variation...")
        # Configure sales patterns:
        # Fast movers: sold in almost every day (1-5 units)
        fast_movers = [
            "PPR-CPY-A4-80", "PAD-STK-3X3-YLW", "PEN-BALL-BLU", "PEN-BALL-BLK",
            "PEN-GEL-05", "ADH-TP-CLR-48", "PPR-REC-A4-75", "FLD-CLR-A4-10"
        ]
        # Moderate movers: sold every 2-4 days
        moderate_movers = [
            "NB-JRN-A5-HRD", "NB-SPR-B5-COL", "NB-GRP-A4-WIRE", "PNC-HB-WOOD",
            "MRK-HLT-PAST", "MRK-WBD-4AST", "PAD-LGL-LTR-3", "PAD-MEMO-PKT-3",
            "ENV-KRFT-C5-50", "ENV-SEC-10-100", "FLD-MNL-LTR-50", "BND-2RNG-A4-25",
            "BND-LEV-75-BLU", "DSK-STP-26-6", "DSK-SCS-8IN-SS", "ADH-GLU-STK-4",
            "ML-BBL-M2-25"
        ]
        # Slow movers: sold once every 1-2 weeks
        slow_movers = [
            "PEN-FINELIN-6", "PNC-MECH-07", "NB-DOT-A5-BUL", "PPR-CRD-A4-WHT",
            "FLD-EXP-13PKT", "IDX-TAB-A4-12", "DSK-STP-HVY-M1", "DSK-PNC-2H-30",
            "DSK-RLR-30-MTL", "DSK-ORG-CAD-ACR", "ADH-TP-DBL-18", "ADH-GLU-ALL-120",
            "ADH-DOT-RMV-300", "ART-WTR-24HP", "ML-STR-FLM-15"
        ]
        # Deliberately zero sales in 60d:
        # "NB-EXEC-LTH-A5", "ART-SKT-A3-PRO"
        # <7 days of history: "ML-TP-FRG-48" (only sold in last 4 days)

        customers = [
            "Walk-in Customer", "Metro Design Studio", "Acme Logistics", "Greenwood Academy",
            "Civic Law Partners", "Horizon Tech Labs", "Dr. Robert Smith", "Sarah Jenkins",
            "Downtown Accounting", "Apex Retail", "Bright Sparks Learning", "Express Print Co"
        ]

        # Deterministic seed for reproducible believable numbers
        rng = random.Random(42)

        # Loop through each day from 56 days ago (8 weeks) up to today
        for day_offset in range(56, -1, -1):
            sale_date = now - timedelta(days=day_offset, hours=rng.randint(2, 8), minutes=rng.randint(5, 50))
            
            # Number of transactions on this day: 2 to 5 sales per day
            num_sales_today = rng.randint(2, 5)
            for s_idx in range(num_sales_today):
                sold_at_time = sale_date + timedelta(minutes=s_idx * 45 + rng.randint(5, 25))
                cust = rng.choice(customers)

                # Select 1 to 3 items for this basket
                candidates = []

                # Always pick 1-2 fast movers
                candidates.extend(rng.sample(fast_movers, k=rng.randint(1, 2)))

                # 50% chance of a moderate mover
                if rng.random() < 0.5:
                    candidates.append(rng.choice(moderate_movers))

                # 20% chance of a slow mover
                if rng.random() < 0.2:
                    candidates.append(rng.choice(slow_movers))

                # Newest product: only eligible if day_offset <= 4
                if day_offset <= 4 and rng.random() < 0.35:
                    candidates.append("ML-TP-FRG-48")

                # Remove duplicates in single sale
                candidates = list(dict.fromkeys(candidates))

                # Check inventory availability before attempting sale
                items_to_sell = []
                for sku in sorted(candidates):
                    prod = products_map[sku]
                    cur_inv = db.scalar(select(models.Inventory).where(
                        models.Inventory.product_id == prod.id,
                        models.Inventory.warehouse_id == wh.id
                    ))
                    avail = cur_inv.quantity if cur_inv else 0
                    
                    # Specific constraints:
                    # Keep PPR-CPY-A4-80 near/below reorder_point (30) -> e.g. target 12
                    # Keep MRK-HLT-PAST near reorder_point (18) -> e.g. target 14
                    # Keep DSK-STP-HVY-M1 below reorder_point (10) -> e.g. target 6
                    qty_to_buy = rng.randint(1, 3)
                    if sku == "PPR-CPY-A4-80" and avail - qty_to_buy < 12:
                        qty_to_buy = max(0, avail - 12)
                    elif sku == "MRK-HLT-PAST" and avail - qty_to_buy < 14:
                        qty_to_buy = max(0, avail - 14)
                    elif sku == "DSK-STP-HVY-M1" and avail - qty_to_buy < 6:
                        qty_to_buy = max(0, avail - 6)

                    if qty_to_buy > 0 and avail >= qty_to_buy:
                        items_to_sell.append((prod, qty_to_buy))

                if not items_to_sell:
                    continue

                sale = models.Sale(
                    business_id=biz.id,
                    warehouse_id=wh.id,
                    status="completed",
                    sold_at=sold_at_time,
                    customer_name=cust,
                    total_amount=Decimal("0.00"),
                    created_by=staff_user.id,
                )
                db.add(sale)
                db.flush()

                sale_total = Decimal("0.00")
                for prod, qty in items_to_sell:
                    mv = change_stock(
                        db,
                        user=staff_user,
                        product=prod,
                        warehouse_id=wh.id,
                        delta=-qty,
                        movement_type="sale",
                        reference_type="sale",
                        reference_id=sale.id,
                    )
                    mv.created_at = sold_at_time

                    sale_item = models.SaleItem(
                        sale_id=sale.id,
                        product_id=prod.id,
                        quantity=qty,
                        unit_price=prod.selling_price,
                        unit_cost=prod.cost_price,
                    )
                    sale.items.append(sale_item)
                    sale_total += Decimal(qty) * prod.selling_price

                sale.total_amount = sale_total
                db.flush()

        # Add 2 cancelled sales with reversal movements to demonstrate cancelled sales
        print("[*] Creating 2 cancelled sales with proper stock_reversal ledger entries...")
        cancelled_cases = [
            (15, "Metro Design Studio", [("NB-JRN-A5-HRD", 3), ("PEN-FINELIN-6", 2)]),
            (5, "Acme Logistics", [("ML-BBL-M2-25", 5)]),
        ]
        for days_ago, cust, c_items in cancelled_cases:
            s_time = now - timedelta(days=days_ago, hours=10)
            c_sale = models.Sale(
                business_id=biz.id,
                warehouse_id=wh.id,
                status="cancelled",
                sold_at=s_time,
                customer_name=cust,
                total_amount=Decimal("0.00"),
                created_by=staff_user.id,
            )
            db.add(c_sale)
            db.flush()

            c_total = Decimal("0.00")
            for c_sku, c_qty in c_items:
                prod = products_map[c_sku]
                # First, sale deduction
                mv_sale = change_stock(
                    db,
                    user=staff_user,
                    product=prod,
                    warehouse_id=wh.id,
                    delta=-c_qty,
                    movement_type="sale",
                    reference_type="sale",
                    reference_id=c_sale.id,
                )
                mv_sale.created_at = s_time

                c_item = models.SaleItem(
                    sale_id=c_sale.id,
                    product_id=prod.id,
                    quantity=c_qty,
                    unit_price=prod.selling_price,
                    unit_cost=prod.cost_price,
                )
                c_sale.items.append(c_item)
                c_total += Decimal(c_qty) * prod.selling_price

                # Immediately followed by reversal (order cancelled by customer)
                mv_rev = change_stock(
                    db,
                    user=admin_user,
                    product=prod,
                    warehouse_id=wh.id,
                    delta=c_qty,
                    movement_type="sale_reversal",
                    reference_type="sale",
                    reference_id=c_sale.id,
                    reason="Customer cancelled order",
                )
                mv_rev.created_at = s_time + timedelta(hours=1)

            c_sale.total_amount = c_total
            db.flush()

        try:
            db.execute(text("SET @STOCKIQ_ALLOW_LEDGER_MUTATION = 0"))
        except Exception:
            pass
        db.commit()
        print("[+] Seed completed successfully!")
        print("    Summary:")
        print(f"    - Categories: {db.scalar(select(func.count(models.Category.id)))}")
        print(f"    - Products: {db.scalar(select(func.count(models.Product.id)))}")
        print(f"    - Suppliers: {db.scalar(select(func.count(models.Supplier.id)))}")
        print(f"    - Purchases: {db.scalar(select(func.count(models.Purchase.id)))}")
        print(f"    - Sales: {db.scalar(select(func.count(models.Sale.id)))}")
        print(f"    - Stock Movements (Ledger): {db.scalar(select(func.count(models.StockMovement.id)))}")


if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    run_seed(reset=reset_flag)
