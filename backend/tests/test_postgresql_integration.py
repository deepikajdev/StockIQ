"""Real PostgreSQL integration tests for StockIQ.

These tests ONLY run when the application URL targets the dedicated local
database ``stockiq_pg_test`` with matching ``STOCKIQ_TEST_DB``. Every other
configuration (including the MySQL test database) skips the module without
opening a connection.

They prove PostgreSQL behaviour against a live server. They are not replaced by
SQLite or by static/config-only checks.
"""

from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from tests.db_guard import POSTGRESQL_TEST_DB_NAME


def _postgresql_test_url():
    """Return the URL only for the explicitly confirmed PostgreSQL test DB."""
    raw = settings.database_url_value
    if not raw:
        return None
    try:
        url = make_url(raw)
    except Exception:
        return None
    if url.get_backend_name() != "postgresql":
        return None
    if (url.database or "").lower() != POSTGRESQL_TEST_DB_NAME:
        return None
    if (url.host or "").strip().lower() not in {"localhost", "127.0.0.1", "::1"}:
        return None
    if os.getenv("STOCKIQ_TEST_DB", "").lower() != POSTGRESQL_TEST_DB_NAME:
        return None
    return url


PG_TEST_URL = _postgresql_test_url()

pytestmark = pytest.mark.skipif(
    PG_TEST_URL is None,
    reason=(
        "PostgreSQL integration tests require DATABASE_URL=postgresql+psycopg://..."
        "/stockiq_pg_test and STOCKIQ_TEST_DB=stockiq_pg_test"
    ),
)


@pytest.fixture()
def pg_db(client):
    """A PostgreSQL session; depends on ``client`` so bootstrap() has run."""
    from app.db import SessionLocal

    with SessionLocal() as db:
        assert db.bind.dialect.name == "postgresql"
        db.rollback()
        yield db
        db.rollback()


def _admin_user(db):
    from app.models import User

    return db.scalar(select(User).where(User.email == "admin@stockiq.example.com"))


def test_postgresql_schema_objects_installed(pg_db):
    """bootstrap() installs tables, views, function and triggers on PostgreSQL."""
    tables = set(
        pg_db.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
            )
        ).scalars()
    )
    assert {
        "businesses", "roles", "categories", "suppliers", "users", "warehouses",
        "products", "product_suppliers", "inventory", "purchases", "purchase_items",
        "sales", "sale_items", "stock_movements", "audit_logs",
    } <= tables

    views = set(
        pg_db.execute(
            text(
                "SELECT table_name FROM information_schema.views "
                "WHERE table_schema = current_schema()"
            )
        ).scalars()
    )
    assert {
        "v_inventory_value", "v_low_stock", "v_daily_sales", "v_product_sales_30d"
    } <= views

    functions = set(
        pg_db.execute(
            text(
                "SELECT proname FROM pg_proc p "
                "JOIN pg_namespace n ON n.oid = p.pronamespace "
                "WHERE n.nspname = current_schema()"
            )
        ).scalars()
    )
    assert "sp_reconcile_inventory" in functions
    assert "trg_stock_movements_no_update_fn" in functions
    assert "trg_stock_movements_no_delete_fn" in functions

    triggers = set(
        pg_db.execute(
            text(
                "SELECT tgname FROM pg_trigger "
                "WHERE NOT tgisinternal AND tgrelid = 'stock_movements'::regclass"
            )
        ).scalars()
    )
    assert {"trg_stock_movements_no_update", "trg_stock_movements_no_delete"} <= triggers


def test_postgresql_native_types(pg_db):
    """PostgreSQL uses identity, BOOLEAN and JSONB rather than MySQL types."""
    columns = {
        (row[0], row[1]): (row[2], row[3])
        for row in pg_db.execute(
            text(
                "SELECT table_name, column_name, data_type, is_identity "
                "FROM information_schema.columns WHERE table_schema = current_schema()"
            )
        ).all()
    }
    assert columns[("products", "id")][1] == "YES"
    assert columns[("users", "is_active")][0] == "boolean"
    assert columns[("warehouses", "is_default")][0] == "boolean"
    assert columns[("products", "is_active")][0] == "boolean"
    assert columns[("audit_logs", "details")][0] == "jsonb"


def test_boolean_predicates_and_reconciliation_function(pg_db):
    """Raw boolean predicates and the set-returning function run on PostgreSQL."""
    from app.services.intelligence_service import run_intelligence_summary

    user = _admin_user(pg_db)
    result = run_intelligence_summary(pg_db, user.business_id)
    assert "items" in result

    rows = pg_db.execute(text("SELECT * FROM sp_reconcile_inventory()")).fetchall()
    assert rows == [], f"Ledger/inventory discrepancies: {rows}"


def test_append_only_ledger_rejects_update_and_delete(client, admin, pg_db):
    """The PostgreSQL trigger blocks ledger mutations with SQLSTATE 45000."""
    from app.models import StockMovement

    suffix = uuid.uuid4().hex[:6].upper()
    response = client.post(
        "/products",
        headers=admin,
        json={
            "sku": f"PGLEDGER-{suffix}",
            "name": f"PG ledger probe {suffix}",
            "selling_price": "10.00",
            "cost_price": "5.00",
        },
    )
    assert response.status_code == 201, response.text
    product_id = response.json()["id"]

    response = client.post(
        "/inventory/adjustments",
        headers=admin,
        json={"product_id": product_id, "quantity_change": 5, "reason": "correction"},
    )
    assert response.status_code == 201, response.text

    movement = pg_db.scalar(
        select(StockMovement)
        .where(StockMovement.product_id == product_id)
        .order_by(StockMovement.id.desc())
        .limit(1)
    )
    assert movement is not None
    assert movement.quantity_change == 5

    with pytest.raises(SQLAlchemyError) as update_error:
        pg_db.execute(
            text("UPDATE stock_movements SET reason = 'tamper' WHERE id = :id"),
            {"id": movement.id},
        )
        pg_db.flush()
    assert "append-only" in str(update_error.value)
    assert getattr(update_error.value.orig, "sqlstate", None) == "45000"
    pg_db.rollback()

    with pytest.raises(SQLAlchemyError) as delete_error:
        pg_db.execute(
            text("DELETE FROM stock_movements WHERE id = :id"),
            {"id": movement.id},
        )
        pg_db.flush()
    assert "append-only" in str(delete_error.value)
    assert getattr(delete_error.value.orig, "sqlstate", None) == "45000"
    pg_db.rollback()

    assert pg_db.get(StockMovement, movement.id) is not None


def test_purchase_row_lock_has_no_outer_join(pg_db):
    """FOR UPDATE must not be applied to a joined nullable supplier row."""
    from app.models import Purchase
    from app.routers.purchases import _get

    user = _admin_user(pg_db)
    purchase = pg_db.scalar(select(Purchase).limit(1))
    if purchase is None:
        pytest.skip("No purchase rows available; seed the PostgreSQL test database")

    locked = _get(pg_db, user, purchase.id, lock=True)
    assert locked.id == purchase.id
