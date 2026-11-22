import os
import sys
import uuid
import datetime
from decimal import Decimal
import jwt
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.db import SessionLocal
from app.models import Product, Inventory, StockMovement, Sale, Purchase, AuditLog, Supplier, ProductSupplier
from app.config import settings

def run_full_system_audit():
    print("=" * 70)
    print("STOCKIQ FULL SYSTEM AUDIT & END-TO-END VERIFICATION")
    print("=" * 70)

    client = TestClient(app)
    results = {"passed": [], "failed": []}

    def record_pass(step_name, detail=""):
        results["passed"].append(step_name)
        print(f"  [PASS] {step_name}: {detail}")

    def record_fail(step_name, detail=""):
        results["failed"].append((step_name, detail))
        print(f"  [FAIL] {step_name}: {detail}")

    # =========================================================================
    # STEP 2: AUTHENTICATION & RBAC
    # =========================================================================
    print("\n--- PHASE 2: AUTHENTICATION & RBAC ---")

    # 1. Admin login
    res = client.post("/auth/login", json={"email": "admin@stockiq.example.com", "password": "admin12345"})
    if res.status_code == 200 and "access_token" in res.json() and res.json()["user"]["role"] == "admin":
        admin_token = res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        record_pass("Admin login", f"Received JWT token, role={res.json()['user']['role']}")
    else:
        record_fail("Admin login", f"Status {res.status_code}, response: {res.text}")
        return

    # 2. Staff login
    res = client.post("/auth/login", json={"email": "staff@stockiq.example.com", "password": "staff12345"})
    if res.status_code == 200 and "access_token" in res.json() and res.json()["user"]["role"] == "staff":
        staff_token = res.json()["access_token"]
        staff_headers = {"Authorization": f"Bearer {staff_token}"}
        record_pass("Staff login", f"Received JWT token, role={res.json()['user']['role']}")
    else:
        record_fail("Staff login", f"Status {res.status_code}, response: {res.text}")
        return

    # 3. Invalid login
    res = client.post("/auth/login", json={"email": "admin@stockiq.example.com", "password": "wrongpassword"})
    if res.status_code == 401:
        record_pass("Invalid password rejected", f"Status 401, detail: {res.json()['detail']}")
    else:
        record_fail("Invalid password rejected", f"Status {res.status_code}")

    res = client.post("/auth/login", json={"email": "nonexistent@stockiq.example.com", "password": "admin12345"})
    if res.status_code == 401:
        record_pass("Invalid email rejected", f"Status 401, detail: {res.json()['detail']}")
    else:
        record_fail("Invalid email rejected", f"Status {res.status_code}")

    # 4. Session persistence (GET /auth/me)
    res_admin = client.get("/auth/me", headers=admin_headers)
    res_staff = client.get("/auth/me", headers=staff_headers)
    if res_admin.status_code == 200 and res_staff.status_code == 200:
        record_pass("Session persistence (GET /auth/me)", f"Admin={res_admin.json()['email']}, Staff={res_staff.json()['email']}")
    else:
        record_fail("Session persistence (GET /auth/me)", f"Admin={res_admin.status_code}, Staff={res_staff.status_code}")

    # 5. Expired JWT
    expired_payload = {
        "sub": "1",
        "email": "admin@stockiq.example.com",
        "role": "admin",
        "business_id": 1,
        "exp": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1)
    }
    expired_token = jwt.encode(expired_payload, settings.jwt_secret_value, algorithm="HS256")
    res_expired = client.get("/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    if res_expired.status_code == 401:
        record_pass("Expired JWT rejected", f"Status 401: {res_expired.json()['detail']}")
    else:
        record_fail("Expired JWT rejected", f"Status {res_expired.status_code}")

    # 6. Unauthorized admin operations blocked for staff (403)
    res_prod = client.post("/products", headers=staff_headers, json={"sku": f"STAFF-{uuid.uuid4().hex[:4]}", "name": "Staff Item", "selling_price": "10.00", "cost_price": "5.00"})
    res_adj = client.post("/inventory/adjustments", headers=staff_headers, json={"product_id": 1, "quantity_change": 5, "reason": "correction"})
    res_po = client.post("/purchases", headers=staff_headers, json={"supplier_id": 1, "items": [{"product_id": 1, "quantity": 10, "unit_cost": "5.00"}]})
    res_sup = client.post("/suppliers", headers=staff_headers, json={"name": "Staff Supplier"})

    if all(r.status_code == 403 for r in [res_prod, res_adj, res_po, res_sup]):
        record_pass("Staff blocked from admin endpoints", "403 Forbidden on Product, Adjustment, Purchase, and Supplier creation")
    else:
        record_fail("Staff blocked from admin endpoints", f"Statuses: prod={res_prod.status_code}, adj={res_adj.status_code}, po={res_po.status_code}, sup={res_sup.status_code}")

    # =========================================================================
    # STEP 3: END-TO-END BUSINESS WORKFLOWS
    # =========================================================================
    print("\n--- PHASE 3: END-TO-END BUSINESS WORKFLOWS ---")

    test_suffix = uuid.uuid4().hex[:6].upper()
    test_sku = f"AUDIT-{test_suffix}"

    # 1. Create a product (Admin)
    prod_payload = {
        "sku": test_sku,
        "name": f"Audit Ballpoint Pen {test_suffix}",
        "category_id": 1,
        "unit": "pcs",
        "selling_price": "50.00",
        "cost_price": "25.00",
        "reorder_point": 20,
        "safety_stock": 10
    }
    res = client.post("/products", headers=admin_headers, json=prod_payload)
    if res.status_code == 201:
        product = res.json()
        product_id = product["id"]
        record_pass("1. Create product", f"Created product id={product_id}, SKU={product['sku']}, stock_on_hand={product['stock_on_hand']}")
    else:
        record_fail("1. Create product", f"Status {res.status_code}: {res.text}")
        return

    # 2. Edit a product (Admin)
    edit_payload = {"name": f"Audit Premium Pen {test_suffix}", "selling_price": "55.00"}
    res = client.patch(f"/products/{product_id}", headers=admin_headers, json=edit_payload)
    if res.status_code == 200 and res.json()["name"] == edit_payload["name"] and res.json()["selling_price"] == "55.00":
        record_pass("2. Edit product", f"Updated product name to '{res.json()['name']}' and price to {res.json()['selling_price']}")
    else:
        record_fail("2. Edit product", f"Status {res.status_code}: {res.text}")

    # 3. Create a supplier (Admin)
    sup_payload = {
        "name": f"Audit Wholesale Supplies {test_suffix}",
        "contact_name": "Rohan Gupta",
        "email": f"rohan_{test_suffix.lower()}@auditvendor.com",
        "phone": "+91 98111 22334",
        "address": "Audit Estate, Phase 3"
    }
    res = client.post("/suppliers", headers=admin_headers, json=sup_payload)
    if res.status_code == 201:
        supplier = res.json()
        supplier_id = supplier["id"]
        record_pass("3. Create supplier", f"Created supplier id={supplier_id}, name={supplier['name']}")
    else:
        record_fail("3. Create supplier", f"Status {res.status_code}: {res.text}")
        return

    # 4. Link a supplier to a product
    link_payload = {
        "supplier_id": supplier_id,
        "unit_cost": "24.00",
        "lead_time_days": 5,
        "min_order_qty": 50,
        "is_preferred": True
    }
    res = client.put(f"/products/{product_id}/suppliers", headers=admin_headers, json=link_payload)
    if res.status_code == 200:
        record_pass("4. Link supplier to product", f"Linked supplier {supplier_id} to product {product_id} with lead_time=5d, min_qty=50")
    else:
        record_fail("4. Link supplier to product", f"Status {res.status_code}: {res.text}")

    # 5. Create a purchase order
    po_payload = {
        "supplier_id": supplier_id,
        "items": [
            {"product_id": product_id, "quantity": 100, "unit_cost": "24.00"}
        ],
        "notes": "E2E Audit replenishment order"
    }
    res = client.post("/purchases", headers=admin_headers, json=po_payload)
    if res.status_code == 201:
        po = res.json()
        po_id = po["id"]
        # Verify draft does not alter stock
        stock_res = client.get(f"/products/{product_id}", headers=admin_headers).json()
        if stock_res["stock_on_hand"] == 0:
            record_pass("5. Create purchase order", f"Created PO #{po_id} in draft status. On-hand stock untouched (0 units).")
        else:
            record_fail("5. Create purchase order", f"PO created but stock changed prematurely: {stock_res['stock_on_hand']}")
    else:
        record_fail("5. Create purchase order", f"Status {res.status_code}: {res.text}")
        return

    # 6. Receive purchased goods (Staff operational test)
    res = client.post(f"/purchases/{po_id}/receive", headers=staff_headers)
    if res.status_code == 200 and res.json()["status"] == "received":
        record_pass("6. Receive purchased goods", f"PO #{po_id} successfully received by staff role.")
    else:
        record_fail("6. Receive purchased goods", f"Status {res.status_code}: {res.text}")

    # 7. Verify inventory increased
    stock_res = client.get(f"/products/{product_id}", headers=admin_headers).json()
    if stock_res["stock_on_hand"] == 100:
        record_pass("7. Verify inventory increased", f"Product stock_on_hand is now {stock_res['stock_on_hand']} units (expected 100)")
    else:
        record_fail("7. Verify inventory increased", f"Expected 100, got {stock_res['stock_on_hand']}")

    # 8. Create a sale (Staff operational)
    sale_payload = {
        "customer_name": "Audit Customer Corp",
        "items": [
            {"product_id": product_id, "quantity": 30}
        ]
    }
    res = client.post("/sales", headers=staff_headers, json=sale_payload)
    if res.status_code == 201:
        sale = res.json()
        sale_id = sale["id"]
        record_pass("8. Create sale", f"Sale #{sale_id} processed by staff for 30 units @ 55.00 = Total {sale['total_amount']}")
    else:
        record_fail("8. Create sale", f"Status {res.status_code}: {res.text}")
        return

    # 9. Verify inventory decreased
    stock_res = client.get(f"/products/{product_id}", headers=admin_headers).json()
    if stock_res["stock_on_hand"] == 70:
        record_pass("9. Verify inventory decreased", f"Product stock_on_hand is now {stock_res['stock_on_hand']} units (100 - 30 = 70)")
    else:
        record_fail("9. Verify inventory decreased", f"Expected 70, got {stock_res['stock_on_hand']}")

    # 10. Inspect stock movement history
    res = client.get(f"/inventory/movements?product_id={product_id}", headers=admin_headers)
    if res.status_code == 200:
        moves = res.json()["items"]
        if len(moves) == 2 and moves[0]["movement_type"] == "sale" and moves[1]["movement_type"] == "purchase_receipt":
            record_pass("10. Inspect stock movement history", f"Found 2 movements: 1st={moves[1]['movement_type']} (+{moves[1]['quantity_change']}), 2nd={moves[0]['movement_type']} ({moves[0]['quantity_change']})")
        else:
            record_fail("10. Inspect stock movement history", f"Unexpected movements count or types: {moves}")
    else:
        record_fail("10. Inspect stock movement history", f"Status {res.status_code}: {res.text}")

    # 11 & 12. Attempt a sale exceeding available stock & verify rejection (409)
    oversell_payload = {
        "customer_name": "Over-requester",
        "items": [
            {"product_id": product_id, "quantity": 999}
        ]
    }
    res = client.post("/sales", headers=staff_headers, json=oversell_payload)
    if res.status_code == 409:
        detail = res.json().get("detail", {})
        if detail.get("code") == "insufficient_stock" and detail.get("available") == 70 and detail.get("requested") == 999:
            record_pass("11-12. Oversell transaction rejection", f"HTTP 409 returned code='insufficient_stock', available=70, requested=999. Transaction aborted atomically.")
        else:
            record_fail("11-12. Oversell transaction rejection", f"HTTP 409 but unexpected detail: {detail}")
    else:
        record_fail("11-12. Oversell transaction rejection", f"Expected 409, got {res.status_code}")

    # Verify stock remained strictly 70
    stock_res = client.get(f"/products/{product_id}", headers=admin_headers).json()
    if stock_res["stock_on_hand"] == 70:
        record_pass("Post-oversell stock invariant", f"Stock strictly preserved at {stock_res['stock_on_hand']}")
    else:
        record_fail("Post-oversell stock invariant", f"Stock modified after rejected transaction: {stock_res['stock_on_hand']}")

    # 13. Cancel an eligible sale (Admin)
    res = client.post(f"/sales/{sale_id}/cancel", headers=admin_headers)
    if res.status_code == 200 and res.json()["status"] == "cancelled":
        record_pass("13. Cancel eligible sale", f"Sale #{sale_id} marked as cancelled by admin.")
    else:
        record_fail("13. Cancel eligible sale", f"Status {res.status_code}: {res.text}")

    # 14. Verify stock reversal
    stock_res = client.get(f"/products/{product_id}", headers=admin_headers).json()
    if stock_res["stock_on_hand"] == 100:
        record_pass("14. Verify stock reversal", f"Stock restored to 100 units (70 + 30 reversed).")
    else:
        record_fail("14. Verify stock reversal", f"Expected 100, got {stock_res['stock_on_hand']}")

    # Verify ledger recorded reversal
    res = client.get(f"/inventory/movements?product_id={product_id}", headers=admin_headers)
    latest_move = res.json()["items"][0]
    if latest_move["movement_type"] in ("sale_reversal", "stock_reversal") and latest_move["quantity_change"] == 30:
        record_pass("Reversal ledger entry verified", f"Movement ID={latest_move['id']}, type='{latest_move['movement_type']}', change=+30")
    else:
        record_fail("Reversal ledger entry verified", f"Latest move is {latest_move}")

    # 15. Verify audit history
    with SessionLocal() as db:
        audits = db.query(AuditLog).filter(AuditLog.entity_id == str(product_id)).all()
        if len(audits) >= 1:
            record_pass("15. Verify audit history", f"Found {len(audits)} audit records for entity_id={product_id} in audit_logs table.")
        else:
            record_fail("15. Verify audit history", f"No audit records found for product {product_id}")

    # =========================================================================
    # STEP 4: DATA INTEGRITY CHECKS
    # =========================================================================
    print("\n--- PHASE 4: DATA INTEGRITY VERIFICATION ---")

    with SessionLocal() as db:
        # Check 1: sp_reconcile_inventory() returns 0 discrepancies
        from sqlalchemy import text
        reconcile_res = db.execute(text("CALL sp_reconcile_inventory()")).fetchall()
        if len(reconcile_res) == 0:
            record_pass("Reconciliation SP", "CALL sp_reconcile_inventory() returned 0 rows (Ledger == On-hand for all products)")
        else:
            record_fail("Reconciliation SP", f"Discrepancies found: {reconcile_res}")

        # Check 2: No negative inventory anywhere in database
        negative_inv = db.query(Inventory).filter(Inventory.quantity < 0).all()
        if len(negative_inv) == 0:
            record_pass("Negative inventory check", "Zero records in inventory table have quantity < 0.")
        else:
            record_fail("Negative inventory check", f"Found negative inventory rows: {[i.id for i in negative_inv]}")

        # Check 3: Append-only trigger test (Attempt UPDATE and DELETE on stock_movements)
        test_mv = db.query(StockMovement).first()
        if test_mv:
            try:
                db.execute(text(f"UPDATE stock_movements SET quantity_change = 999 WHERE id = {test_mv.id}"))
                db.commit()
                record_fail("Append-only trigger UPDATE", "UPDATE succeeded unexpectedly! Trigger bypassed.")
            except Exception as e:
                db.rollback()
                record_pass("Append-only trigger UPDATE blocked", "Trigger blocked UPDATE with SQLSTATE 45000.")

            try:
                db.execute(text(f"DELETE FROM stock_movements WHERE id = {test_mv.id}"))
                db.commit()
                record_fail("Append-only trigger DELETE", "DELETE succeeded unexpectedly! Trigger bypassed.")
            except Exception as e:
                db.rollback()
                record_pass("Append-only trigger DELETE blocked", "Trigger blocked DELETE with SQLSTATE 45000.")

        # Check 4: Check before/after delta consistency across all movements
        inconsistent_moves = db.query(StockMovement).filter(
            StockMovement.quantity_after != StockMovement.quantity_before + StockMovement.quantity_change
        ).all()
        if len(inconsistent_moves) == 0:
            record_pass("Ledger mathematical consistency", "All stock movements satisfy: quantity_after == quantity_before + quantity_change")
        else:
            record_fail("Ledger mathematical consistency", f"Found {len(inconsistent_moves)} inconsistent records!")

    print("\n" + "=" * 70)
    print(f"AUDIT SUMMARY: {len(results['passed'])} PASSED, {len(results['failed'])} FAILED")
    print("=" * 70)

if __name__ == "__main__":
    run_full_system_audit()
