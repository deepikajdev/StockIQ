import threading

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Inventory, StockMovement


def stock(client, headers, pid):
    return client.get(f"/products/{pid}", headers=headers).json()["stock_on_hand"]


def test_duplicate_sku_rejected(client, admin):
    body = {"sku": "DUP-1", "name": "x", "selling_price": "1.00", "cost_price": "1.00"}
    client.post("/products", json=body, headers=admin)
    assert client.post("/products", json=body, headers=admin).status_code == 409


def test_staff_cannot_do_admin_actions(client, staff, product):
    p = product()
    assert client.post("/products", headers=staff, json={"sku": "S1", "name": "n", "selling_price": "1", "cost_price": "1"}).status_code == 403
    assert client.post("/inventory/adjustments", headers=staff, json={"product_id": p["id"], "quantity_change": 5, "reason": "found"}).status_code == 403
    assert client.get("/products", headers=staff).status_code == 200


def test_unauthenticated_rejected(client):
    assert client.get("/products").status_code == 401


def test_receive_purchase_increases_stock_and_ledger(client, admin, product, supplier):
    p = product()
    r = client.post("/purchases", headers=admin, json={"supplier_id": supplier["id"], "items": [
        {"product_id": p["id"], "quantity": 20, "unit_cost": "5.50"}]})
    assert r.status_code == 201 and r.json()["status"] == "draft"
    assert stock(client, admin, p["id"]) == 0          # draft does not touch stock
    rec = client.post(f"/purchases/{r.json()['id']}/receive", headers=admin)
    assert rec.status_code == 200 and rec.json()["status"] == "received"
    assert stock(client, admin, p["id"]) == 20
    mv = client.get(f"/inventory/movements?product_id={p['id']}", headers=admin).json()["items"][0]
    assert mv["movement_type"] == "purchase_receipt" and mv["quantity_change"] == 20
    # cannot receive twice
    assert client.post(f"/purchases/{r.json()['id']}/receive", headers=admin).status_code == 409


def test_sale_decreases_stock(client, staff, admin, product):
    p = product(stock=10)
    r = client.post("/sales", headers=staff, json={"items": [{"product_id": p["id"], "quantity": 4}]})
    assert r.status_code == 201 and r.json()["total_amount"] == "40.00"
    assert stock(client, admin, p["id"]) == 6


def test_insufficient_stock_rolls_back_everything(client, staff, admin, product):
    a, b = product(stock=5), product(stock=1)
    sales_before = client.get("/sales", headers=admin).json()["total"]
    r = client.post("/sales", headers=staff, json={"items": [
        {"product_id": a["id"], "quantity": 3}, {"product_id": b["id"], "quantity": 2}]})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "insufficient_stock"
    assert stock(client, admin, a["id"]) == 5 and stock(client, admin, b["id"]) == 1   # first line not deducted
    assert client.get("/sales", headers=admin).json()["total"] == sales_before          # no partial sale row
    moves = client.get(f"/inventory/movements?product_id={a['id']}", headers=admin).json()["total"]
    assert moves == 1                                                                   # only opening balance


def test_adjustment_audited_and_never_negative(client, admin, product):
    p = product(stock=3)
    assert client.post("/inventory/adjustments", headers=admin, json={"product_id": p["id"], "quantity_change": -5, "reason": "lost"}).status_code == 409
    r = client.post("/inventory/adjustments", headers=admin, json={"product_id": p["id"], "quantity_change": -2, "reason": "damaged", "note": "dropped"})
    assert r.status_code == 201
    m = r.json()
    assert (m["quantity_before"], m["quantity_after"], m["quantity_change"]) == (3, 1, -2)
    assert m["reason"].startswith("damaged") and m["user_name"]


def test_cancel_sale_restores_stock_with_reversal(client, admin, staff, product):
    p = product(stock=10)
    s = client.post("/sales", headers=staff, json={"items": [{"product_id": p["id"], "quantity": 7}]}).json()
    assert client.post(f"/sales/{s['id']}/cancel", headers=staff).status_code == 403
    assert client.post(f"/sales/{s['id']}/cancel", headers=admin).status_code == 200
    assert stock(client, admin, p["id"]) == 10
    assert client.post(f"/sales/{s['id']}/cancel", headers=admin).status_code == 409


def test_concurrent_sales_never_oversell(client, staff, admin, product):
    p = product(stock=10)
    results = []

    def buy():
        r = client.post("/sales", headers=staff, json={"items": [{"product_id": p["id"], "quantity": 1}]})
        results.append(r.status_code)

    threads = [threading.Thread(target=buy) for _ in range(25)]
    [t.start() for t in threads]; [t.join() for t in threads]
    assert results.count(201) == 10 and results.count(409) == 15
    assert stock(client, admin, p["id"]) == 0


def test_inventory_matches_ledger(client):
    with SessionLocal() as db:
        ledger = dict(db.execute(select(StockMovement.product_id, func.sum(StockMovement.quantity_change))
                                 .group_by(StockMovement.product_id)).all())
        for inv in db.scalars(select(Inventory)):
            assert inv.quantity == ledger.get(inv.product_id, 0), inv.product_id


def test_validation(client, admin, staff, product):
    p = product(stock=2)
    assert client.post("/sales", headers=staff, json={"items": [{"product_id": p["id"], "quantity": 0}]}).status_code == 422
    assert client.post("/sales", headers=staff, json={"items": []}).status_code == 422
    assert client.post("/sales", headers=staff, json={"items": [{"product_id": 999999, "quantity": 1}]}).status_code == 422
    assert client.post("/auth/login", json={"email": "admin@stockiq.example.com", "password": "wrong"}).status_code == 401
