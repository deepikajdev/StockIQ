"""Purchase-order permission regression tests.

Policy: admins may view, create, edit and receive purchase orders. Staff may
view and receive existing draft orders but may not create or edit them.
"""

from app.routers.purchases import router as purchase_router


def _stock(client, headers, product_id):
    response = client.get(f"/products/{product_id}", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["stock_on_hand"]


def _draft(client, admin, supplier, product):
    p = product()
    response = client.post(
        "/purchases",
        headers=admin,
        json={
            "supplier_id": supplier["id"],
            "items": [{"product_id": p["id"], "quantity": 12, "unit_cost": "5.00"}],
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "draft"
    return p, response.json()


def test_staff_can_view_purchase_orders(client, admin, staff, supplier, product):
    _, purchase = _draft(client, admin, supplier, product)

    listing = client.get("/purchases", headers=staff)
    assert listing.status_code == 200, listing.text
    assert any(item["id"] == purchase["id"] for item in listing.json()["items"])

    detail = client.get(f"/purchases/{purchase['id']}", headers=staff)
    assert detail.status_code == 200, detail.text
    assert detail.json()["id"] == purchase["id"]


def test_staff_can_receive_existing_draft_purchase(client, admin, staff, supplier, product):
    p, purchase = _draft(client, admin, supplier, product)
    assert _stock(client, admin, p["id"]) == 0

    received = client.post(f"/purchases/{purchase['id']}/receive", headers=staff)
    assert received.status_code == 200, received.text
    assert received.json()["status"] == "received"
    assert _stock(client, admin, p["id"]) == 12

    duplicate = client.post(f"/purchases/{purchase['id']}/receive", headers=staff)
    assert duplicate.status_code == 409


def test_staff_cannot_create_or_edit_purchase_orders(client, admin, staff, supplier, product):
    p, purchase = _draft(client, admin, supplier, product)

    create = client.post(
        "/purchases",
        headers=staff,
        json={
            "supplier_id": supplier["id"],
            "items": [{"product_id": p["id"], "quantity": 1, "unit_cost": "5.00"}],
        },
    )
    assert create.status_code == 403

    cancel = client.post(f"/purchases/{purchase['id']}/cancel", headers=staff)
    assert cancel.status_code == 403

    methods_by_path = {route.path: route.methods for route in purchase_router.routes}
    assert not any({"PUT", "PATCH"} & methods for methods in methods_by_path.values())


def test_admin_can_create_edit_and_receive_purchase_orders(client, admin, supplier, product):
    p, purchase = _draft(client, admin, supplier, product)

    received = client.post(f"/purchases/{purchase['id']}/receive", headers=admin)
    assert received.status_code == 200, received.text
    assert _stock(client, admin, p["id"]) == 12

    _, other = _draft(client, admin, supplier, product)
    cancelled = client.post(f"/purchases/{other['id']}/cancel", headers=admin)
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
