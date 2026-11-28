-- StockIQ Database Views (PostgreSQL)
-- PostgreSQL equivalent of db/views.sql. MySQL support remains in the original file.

-- ---------------------------------------------------------------------------
-- 1. v_inventory_value
-- Product, quantity on hand, unit cost, and total stock valuation
-- ---------------------------------------------------------------------------
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
LEFT JOIN warehouses w ON i.warehouse_id = w.id;

-- ---------------------------------------------------------------------------
-- 2. v_low_stock
-- Active products where current quantity is at or below the reorder point
-- ---------------------------------------------------------------------------
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
  AND COALESCE(i.quantity, 0) <= p.reorder_point;

-- ---------------------------------------------------------------------------
-- 3. v_daily_sales
-- Date, completed sales count, total units sold, and total revenue
-- Only completed sales are included.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT
    CAST(s.sold_at AS DATE) AS sale_date,
    COUNT(DISTINCT s.id) AS sales_count,
    COALESCE(SUM(si.quantity), 0) AS units_sold,
    COALESCE(SUM(si.quantity * si.unit_price), 0.00) AS revenue
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
WHERE s.status = 'completed'
GROUP BY CAST(s.sold_at AS DATE);

-- ---------------------------------------------------------------------------
-- 4. v_product_sales_30d
-- Units sold and revenue per product over the trailing 30 days (cancelled sales excluded)
-- ---------------------------------------------------------------------------
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
GROUP BY p.id, p.sku, p.name, c.name;
