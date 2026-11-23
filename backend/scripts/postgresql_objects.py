"""Idempotent PostgreSQL database objects installed after ``create_all()``.

The MySQL application never executes this module. PostgreSQL deployments need
the same views, reconciliation function and append-only triggers that the
hand-written ``db/postgresql/*.sql`` files provide, but a container running only
``backend/`` may not have those files on disk. Embedding the statements here
keeps ``python -m scripts.bootstrap`` sufficient for a fresh PostgreSQL database.
"""

from __future__ import annotations

from sqlalchemy.engine import Engine

POSTGRESQL_OBJECT_STATEMENTS: tuple[str, ...] = (
    """
    CREATE OR REPLACE VIEW v_inventory_value AS
    SELECT
        p.id AS product_id,
        p.sku,
        p.name AS product_name,
        c.name AS category_name,
        p.unit,
        COALESCE(i.warehouse_id, w.id) AS warehouse_id,
        COALESCE(w.name, 'Default Warehouse') AS warehouse_name,
        COALESCE(i.quantity, 0) AS quantity,
        p.cost_price,
        ROUND(COALESCE(i.quantity, 0) * p.cost_price, 2) AS stock_value
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN warehouses w ON i.warehouse_id = w.id
    """,
    """
    CREATE OR REPLACE VIEW v_low_stock AS
    SELECT
        p.id AS product_id,
        p.sku,
        p.name AS product_name,
        c.name AS category_name,
        COALESCE(i.warehouse_id, w.id) AS warehouse_id,
        COALESCE(i.quantity, 0) AS quantity,
        p.reorder_point,
        p.safety_stock,
        (p.reorder_point - COALESCE(i.quantity, 0)) AS reorder_deficit,
        p.cost_price,
        p.is_active
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN inventory i ON p.id = i.product_id
    LEFT JOIN warehouses w ON i.warehouse_id = w.id
    WHERE p.is_active IS TRUE
      AND COALESCE(i.quantity, 0) <= p.reorder_point
    """,
    """
    CREATE OR REPLACE VIEW v_daily_sales AS
    SELECT
        CAST(s.sold_at AS DATE) AS sale_date,
        COUNT(DISTINCT s.id) AS sales_count,
        COALESCE(SUM(si.quantity), 0) AS units_sold,
        COALESCE(SUM(si.quantity * si.unit_price), 0.00) AS revenue
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    WHERE s.status = 'completed'
    GROUP BY CAST(s.sold_at AS DATE)
    """,
    """
    CREATE OR REPLACE VIEW v_product_sales_30d AS
    SELECT
        p.id AS product_id,
        p.sku,
        p.name AS product_name,
        c.name AS category_name,
        COALESCE(SUM(si.quantity), 0) AS units_sold,
        COALESCE(SUM(si.quantity * si.unit_price), 0.00) AS revenue
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN sale_items si ON p.id = si.product_id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status <> 'cancelled'
      AND s.sold_at >= (CURRENT_TIMESTAMP - INTERVAL '30 days')
    GROUP BY p.id, p.sku, p.name, c.name
    """,
    """
    DROP FUNCTION IF EXISTS sp_reconcile_inventory();

    CREATE FUNCTION sp_reconcile_inventory()
    RETURNS TABLE (
        product_id INTEGER,
        sku VARCHAR(64),
        product_name VARCHAR(200),
        warehouse_id INTEGER,
        warehouse_name VARCHAR(100),
        inventory_quantity INTEGER,
        ledger_quantity BIGINT,
        discrepancy BIGINT
    )
    LANGUAGE sql
    STABLE
    AS $fn$
        SELECT
            i.product_id,
            p.sku,
            p.name AS product_name,
            i.warehouse_id,
            w.name AS warehouse_name,
            i.quantity AS inventory_quantity,
            COALESCE(m.ledger_quantity, 0)::BIGINT AS ledger_quantity,
            (i.quantity::BIGINT - COALESCE(m.ledger_quantity, 0)::BIGINT) AS discrepancy
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN warehouses w ON i.warehouse_id = w.id
        LEFT JOIN (
            SELECT product_id, warehouse_id, SUM(quantity_change) AS ledger_quantity
            FROM stock_movements
            GROUP BY product_id, warehouse_id
        ) m ON i.product_id = m.product_id AND i.warehouse_id = m.warehouse_id
        WHERE i.quantity <> COALESCE(m.ledger_quantity, 0)
        ORDER BY i.product_id
    $fn$;
    """,
    """
    CREATE OR REPLACE FUNCTION trg_stock_movements_no_update_fn()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
        IF COALESCE(current_setting('stockiq.allow_ledger_mutation', true), '') <> '1' THEN
            RAISE EXCEPTION
                'Stock movement ledger is append-only: UPDATE is strictly prohibited'
                USING ERRCODE = '45000';
        END IF;
        RETURN NEW;
    END;
    $fn$;
    """,
    """
    CREATE OR REPLACE FUNCTION trg_stock_movements_no_delete_fn()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
        IF COALESCE(current_setting('stockiq.allow_ledger_mutation', true), '') <> '1' THEN
            RAISE EXCEPTION
                'Stock movement ledger is append-only: DELETE is strictly prohibited'
                USING ERRCODE = '45000';
        END IF;
        RETURN OLD;
    END;
    $fn$;
    """,
    """
    DROP TRIGGER IF EXISTS trg_stock_movements_no_update ON stock_movements;
    CREATE TRIGGER trg_stock_movements_no_update
    BEFORE UPDATE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION trg_stock_movements_no_update_fn();
    """,
    """
    DROP TRIGGER IF EXISTS trg_stock_movements_no_delete ON stock_movements;
    CREATE TRIGGER trg_stock_movements_no_delete
    BEFORE DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION trg_stock_movements_no_delete_fn();
    """,
    """
    CREATE OR REPLACE FUNCTION trg_set_updated_at_fn()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $fn$;
    """,
    """
    DROP TRIGGER IF EXISTS trg_products_set_updated_at ON products;
    CREATE TRIGGER trg_products_set_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_fn();
    """,
    """
    DROP TRIGGER IF EXISTS trg_inventory_set_updated_at ON inventory;
    CREATE TRIGGER trg_inventory_set_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_fn();
    """,
)


def install_postgresql_objects(engine: Engine) -> bool:
    """Install PostgreSQL objects; return True when this engine is PostgreSQL."""
    if engine.dialect.name != "postgresql":
        return False
    with engine.begin() as connection:
        for statement in POSTGRESQL_OBJECT_STATEMENTS:
            connection.exec_driver_sql(statement)
    return True
