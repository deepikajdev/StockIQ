"""Intelligence engine tests.

The analytics service is exercised against a temporary SQLite database so the
suite does not require the MySQL instance used by the end-to-end tests.  The
routes are tested through FastAPI with the DB and auth dependencies overridden.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.deps import current_user
from app.main import app
from app.models import (
    Business,
    Category,
    Inventory,
    Product,
    ProductSupplier,
    Role,
    Sale,
    SaleItem,
    Supplier,
    User,
    Warehouse,
)
from app.services import intelligence_service as service


@pytest.fixture()
def db_session(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'intelligence.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with Session() as db:
        db.add_all(
            [
                Business(id=1, name="Test Shop"),
                Business(id=2, name="Other Shop"),
                Role(id=1, name="admin"),
                Role(id=2, name="staff"),
            ]
        )
        db.flush()
        db.add(
            User(
                id=1,
                business_id=1,
                role_id=1,
                email="admin@test.example.com",
                full_name="Admin",
                password_hash="x",
            )
        )
        db.add(
            Warehouse(
                id=1, business_id=1, name="Main Store", is_default=True
            )
        )
        db.add_all(
            [
                Category(id=1, business_id=1, name="Stationery"),
                Category(id=2, business_id=1, name="Art"),
            ]
        )
        db.add(
            Supplier(
                id=1,
                business_id=1,
                name="Test Supplier",
                is_active=True,
            )
        )
        db.flush()

        products = [
            Product(
                id=1,
                business_id=1,
                category_id=1,
                sku="FAST-1",
                name="Fast Mover",
                unit="pcs",
                selling_price=Decimal("10.00"),
                cost_price=Decimal("6.00"),
                reorder_point=20,
                safety_stock=10,
                is_active=True,
            ),
            Product(
                id=2,
                business_id=1,
                category_id=1,
                sku="DEAD-1",
                name="Dead Stock",
                unit="pcs",
                selling_price=Decimal("10.00"),
                cost_price=Decimal("5.00"),
                reorder_point=10,
                safety_stock=5,
                is_active=True,
            ),
            Product(
                id=3,
                business_id=1,
                category_id=1,
                sku="EXCESS-1",
                name="Excess Stock",
                unit="pcs",
                selling_price=Decimal("10.00"),
                cost_price=Decimal("4.00"),
                reorder_point=10,
                safety_stock=5,
                is_active=True,
            ),
            Product(
                id=4,
                business_id=1,
                category_id=2,
                sku="SPARSE-1",
                name="Sparse History",
                unit="pcs",
                selling_price=Decimal("10.00"),
                cost_price=Decimal("4.00"),
                reorder_point=5,
                safety_stock=2,
                is_active=True,
            ),
            Product(
                id=5,
                business_id=2,
                category_id=None,
                sku="OTHER-1",
                name="Other Tenant",
                unit="pcs",
                selling_price=Decimal("10.00"),
                cost_price=Decimal("4.00"),
                reorder_point=5,
                safety_stock=2,
                is_active=True,
            ),
        ]
        db.add_all(products)
        db.add_all(
            [
                Inventory(id=1, product_id=1, warehouse_id=1, quantity=5),
                Inventory(id=2, product_id=2, warehouse_id=1, quantity=40),
                Inventory(id=3, product_id=3, warehouse_id=1, quantity=500),
                Inventory(id=4, product_id=4, warehouse_id=1, quantity=10),
                Inventory(id=5, product_id=5, warehouse_id=1, quantity=10),
                ProductSupplier(
                    id=1,
                    product_id=1,
                    supplier_id=1,
                    unit_cost=Decimal("5.50"),
                    lead_time_days=7,
                    min_order_qty=50,
                    is_preferred=True,
                ),
            ]
        )

        today = datetime.utcnow().date()
        sale_id = 0
        for offset in range(30):
            sold_at = datetime.combine(today - timedelta(days=offset), time(10, 0))
            for product_id, qty in ((1, 2), (3, 3)):
                sale_id += 1
                sale = Sale(
                    id=sale_id,
                    business_id=1,
                    warehouse_id=1,
                    status="completed",
                    sold_at=sold_at,
                    total_amount=Decimal(qty * 10),
                    created_by=1,
                )
                db.add(sale)
                db.flush()
                db.add(
                    SaleItem(
                        id=sale_id,
                        sale_id=sale.id,
                        product_id=product_id,
                        quantity=qty,
                        unit_price=Decimal("10.00"),
                        unit_cost=Decimal("5.00"),
                    )
                )
            if offset in (1, 15):
                sale_id += 1
                sale = Sale(
                    id=sale_id,
                    business_id=1,
                    warehouse_id=1,
                    status="completed",
                    sold_at=sold_at,
                    total_amount=Decimal("10.00"),
                    created_by=1,
                )
                db.add(sale)
                db.flush()
                db.add(
                    SaleItem(
                        id=sale_id,
                        sale_id=sale.id,
                        product_id=4,
                        quantity=1,
                        unit_price=Decimal("10.00"),
                        unit_cost=Decimal("4.00"),
                    )
                )
        db.commit()
        yield Session

    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(db_session):
    def override_db():
        db = db_session()
        try:
            yield db
        finally:
            db.close()

    def override_user():
        return SimpleNamespace(
            id=1,
            business_id=1,
            role=SimpleNamespace(name="admin"),
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[current_user] = override_user
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Pure-function unit tests
# ---------------------------------------------------------------------------


def test_weighted_average_favours_recent_days():
    today = date(2026, 11, 20)
    series = {
        today: 10,
        today - timedelta(days=20): 10,
    }
    stats = service.compute_demand_stats(series, today)
    assert stats["total_units_sold"] == 20
    # 10 recent units weigh 3, 10 older units weigh 2 -> 5.0 is not the answer;
    # the weighted sum includes zero-demand days.
    assert stats["weighted_daily_demand"] > stats["avg_daily_demand"]


def test_stockout_risk_is_critical_before_lead_time():
    result = service.compute_stockout_prediction(2.0, 6, 7)
    assert result["days_until_stockout"] == 3.0
    assert result["stockout_risk"] == "critical"
    assert result["will_stockout_before_reorder"] is True


def test_reorder_recommendation_respects_moq_and_explains():
    supplier = {
        "supplier_id": 1,
        "supplier_name": "Test Supplier",
        "lead_time_days": 7,
        "min_order_qty": 50,
        "unit_cost": "5.50",
    }
    result = service.compute_reorder_recommendation(
        daily_demand=1.5,
        current_stock=5,
        configured_reorder_point=10,
        safety_stock=8,
        lead_time_days=7,
        min_order_qty=50,
        supplier=supplier,
    )
    assert result["needs_reorder"] is True
    assert result["reorder_qty"] == 50
    assert result["estimated_order_cost"] == Decimal("275.00")
    assert any("Advisory only" in line for line in result["explanation"])


def test_risk_categories_are_deterministic():
    dead = service.compute_risk(
        current_stock=40,
        daily_demand=0.0,
        effective_reorder_point=10,
        lead_time_days=7,
        total_units_sold=0,
        days_since_last_sale=None,
    )
    assert dead["risk_category"] == "dead_stock"
    assert dead["risk_score"] >= 80

    critical = service.compute_risk(
        current_stock=0,
        daily_demand=2.0,
        effective_reorder_point=20,
        lead_time_days=7,
        total_units_sold=60,
        days_since_last_sale=1,
    )
    assert critical["risk_category"] == "critical"
    assert critical["risk_score"] == 100


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------


def test_summary_returns_analysis_for_business_only(client):
    response = client.get("/intelligence/summary")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["counts"]["total_products"] == 4
    assert body["algorithm"] == service.ALGORITHM_NAME
    skus = {item["sku"] for item in body["items"]}
    assert "OTHER-1" not in skus
    assert "FAST-1" in skus
    assert all(item["forecast"]["is_machine_learning"] is False for item in body["items"])


def test_reorder_queue_only_contains_products_needing_stock(client):
    response = client.get("/intelligence/reorder-recommendations")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == len(body["items"])
    assert body["items"], "fast mover should require replenishment"
    assert all(
        item["reorder_recommendation"]["needs_reorder"] for item in body["items"]
    )
    fast = next(i for i in body["items"] if i["sku"] == "FAST-1")
    assert fast["reorder_recommendation"]["reorder_qty"] >= 50  # MOQ respected
    assert fast["reorder_recommendation"]["supplier"]["supplier_name"] == "Test Supplier"


def test_risk_report_identifies_dead_and_slow_stock(client):
    response = client.get("/intelligence/risk")
    assert response.status_code == 200, response.text
    body = response.json()
    categories = {i["sku"]: i["risk"]["risk_category"] for i in body["items"]}
    assert categories["DEAD-1"] == "dead_stock"
    assert categories["FAST-1"] in {"critical", "low_stock"}
    assert body["counts"]["dead_stock"] >= 1


def test_product_endpoint_404_for_other_tenant_and_missing_product(client):
    assert client.get("/intelligence/products/5").status_code == 404
    assert client.get("/intelligence/products/99999").status_code == 404


def test_forecast_series_has_history_and_projection(client):
    response = client.get("/intelligence/products/1/forecast?history_days=30&forecast_days=14")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["history_days"] == 30
    assert body["forecast_days"] == 14
    assert len(body["points"]) == 44
    assert sum(1 for p in body["points"] if p["is_forecast"]) == 14
    assert sum(1 for p in body["points"] if not p["is_forecast"]) == 30


def test_evaluation_reports_metrics_and_limitations(client):
    response = client.get("/intelligence/evaluation")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["products_evaluated"] >= 1
    assert body["metrics"]["mae_model"] >= 0
    assert body["metrics"]["mae_naive"] >= 0
    assert body["metrics"]["model_beats_naive_baseline"] is not None
    assert body["data_limitations"]
    assert {p["better_model"] for p in body["per_product"]} <= {"model", "naive", "tie"}


def test_intelligence_endpoints_never_mutate_data(client, db_session):
    with db_session() as db:
        before = db.query(Sale).count()
    client.get("/intelligence/summary")
    client.get("/intelligence/reorder-recommendations")
    client.get("/intelligence/risk")
    client.get("/intelligence/evaluation")
    with db_session() as db:
        assert db.query(Sale).count() == before


# ---------------------------------------------------------------------------
# Honesty / safety regression tests
# ---------------------------------------------------------------------------


def test_zero_sales_product_is_not_assigned_fabricated_demand(client):
    response = client.get("/intelligence/summary")
    assert response.status_code == 200, response.text
    dead = next(i for i in response.json()["items"] if i["sku"] == "DEAD-1")

    assert dead["forecast"]["daily_demand"] == 0
    assert dead["forecast"]["method"] == "no_recent_sales_zero_baseline"
    assert dead["forecast"]["uses_category_fallback"] is False
    assert dead["demand_stats"]["observed_sale_days"] == 0
    assert dead["stockout_prediction"]["stockout_risk"] == "none"
    assert dead["reorder_recommendation"]["needs_reorder"] is False
    assert dead["reorder_recommendation"]["reorder_qty"] == 0
    assert dead["risk"]["risk_category"] == "dead_stock"


def test_assumed_lead_time_is_disclosed(client):
    response = client.get("/intelligence/summary")
    assert response.status_code == 200, response.text
    sparse = next(i for i in response.json()["items"] if i["sku"] == "SPARSE-1")

    assert sparse["stockout_prediction"]["lead_time_is_assumed"] is True
    assert sparse["reorder_recommendation"]["supplier"] is None
    assert any("No active preferred supplier" in line
               for line in sparse["reorder_recommendation"]["explanation"])

    fast = next(i for i in response.json()["items"] if i["sku"] == "FAST-1")
    assert fast["stockout_prediction"]["lead_time_is_assumed"] is False


def test_risk_filter_is_validated_and_applied(client):
    assert client.get("/intelligence/risk?risk_category=dead_stock").status_code == 200
    assert client.get("/intelligence/risk?risk_category=not_a_category").status_code == 422

    body = client.get("/intelligence/risk?risk_category=dead_stock").json()
    assert body["items"]
    assert all(i["risk"]["risk_category"] == "dead_stock" for i in body["items"])
    # Counts describe the whole business, not the filtered view.
    assert body["counts"]["total_products"] >= len(body["items"])


def test_evaluation_window_matches_production_window(client):
    body = client.get("/intelligence/evaluation").json()
    assert body["train_window"]["days"] == service.ANALYSIS_WINDOW_DAYS
    assert body["test_window"]["days"] == 14


def test_structured_explanation_discloses_all_inputs(client):
    body = client.get("/intelligence/products/1").json()
    details = body["reorder_recommendation"]["explanation_details"]

    assert details["lookback_days"] == service.ANALYSIS_WINDOW_DAYS
    assert details["window_end"] is not None
    assert details["units_sold"] == 60
    assert details["lead_time_source"] == "Test Supplier"
    assert details["lead_time_is_assumed"] is False
    assert details["adjusted_for_moq"] is True
    assert details["disclaimer"] == "Estimate based on recent sales; not a guarantee."
    assert "ceil" in details["formula_reorder_point"]


def test_stock_is_scoped_to_default_warehouse(client, db_session):
    with db_session() as db:
        db.add(Warehouse(id=2, business_id=1, name="Overflow", is_default=False))
        db.flush()
        db.add(Inventory(id=99, product_id=1, warehouse_id=2, quantity=10_000))
        db.commit()

    body = client.get("/intelligence/products/1").json()
    assert body["current_stock"] == 5
