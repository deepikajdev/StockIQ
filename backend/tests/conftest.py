import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from scripts.bootstrap import run as bootstrap


@pytest.fixture(scope="session")
def client():
    bootstrap()
    with TestClient(app) as c:
        yield c


def _login(client, email, pw):
    r = client.post("/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin(client):
    return _login(client, "admin@stockiq.example.com", "admin12345")


@pytest.fixture(scope="session")
def staff(client):
    return _login(client, "staff@stockiq.example.com", "staff12345")


@pytest.fixture()
def product(client, admin):
    def make(stock=0, price="10.00", cost="6.00", **kw):
        body = {"sku": f"T-{uuid.uuid4().hex[:8]}", "name": "Test item", "selling_price": price,
                "cost_price": cost, **kw}
        r = client.post("/products", json=body, headers=admin)
        assert r.status_code == 201, r.text
        p = r.json()
        if stock:
            a = client.post("/inventory/adjustments", headers=admin, json={
                "product_id": p["id"], "quantity_change": stock, "reason": "opening_balance"})
            assert a.status_code == 201, a.text
        return p
    return make


@pytest.fixture()
def supplier(client, admin):
    r = client.post("/suppliers", json={"name": f"Sup-{uuid.uuid4().hex[:6]}"}, headers=admin)
    assert r.status_code == 201, r.text
    return r.json()
