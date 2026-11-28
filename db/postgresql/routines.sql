-- StockIQ Database Function (PostgreSQL)
-- PostgreSQL equivalent of db/routines.sql. MySQL support remains in the original file.
-- The MySQL procedure sp_reconcile_inventory() becomes a set-returning SQL function.
-- Invoke with: SELECT * FROM sp_reconcile_inventory();

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
AS $$
    -- Reconciles current inventory balances against the append-only stock_movements
    -- ledger. Returns only rows where inventory.quantity differs from the cumulative
    -- sum of stock_movements.quantity_change for that product and warehouse.
    -- Zero rows returned indicates a fully consistent ledger.
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
        SELECT
            product_id,
            warehouse_id,
            SUM(quantity_change) AS ledger_quantity
        FROM stock_movements
        GROUP BY product_id, warehouse_id
    ) m ON i.product_id = m.product_id AND i.warehouse_id = m.warehouse_id
    WHERE i.quantity <> COALESCE(m.ledger_quantity, 0)
    ORDER BY i.product_id;
$$;
