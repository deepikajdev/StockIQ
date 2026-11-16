-- StockIQ Analytical Views
-- All monetary values computed from DECIMAL columns; no FLOAT.
-- All date filtering uses UTC DATETIME comparisons.

-- v_inventory_value: current stock value per product across all warehouses
CREATE OR REPLACE VIEW `v_inventory_value` AS
SELECT
    p.id                                      AS product_id,
    p.sku,
    p.name                                    AS product_name,
    c.name                                    AS category_name,
    p.unit,
    COALESCE(SUM(i.quantity), 0)              AS quantity_on_hand,
    p.cost_price,
    p.selling_price,
    COALESCE(SUM(i.quantity), 0) * p.cost_price    AS cost_stock_value,
    COALESCE(SUM(i.quantity), 0) * p.selling_price AS retail_stock_value,
    p.reorder_point,
    p.safety_stock,
    p.is_active
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN inventory i  ON i.product_id = p.id
GROUP BY
    p.id, p.sku, p.name, c.name, p.unit,
    p.cost_price, p.selling_price,
    p.reorder_point, p.safety_stock, p.is_active;

-- v_low_stock: products at or below their reorder point
CREATE OR REPLACE VIEW `v_low_stock` AS
SELECT
    iv.product_id,
    iv.sku,
    iv.product_name,
    iv.category_name,
    iv.quantity_on_hand,
    iv.reorder_point,
    iv.safety_stock,
    iv.reorder_point - iv.quantity_on_hand AS units_short,
    iv.cost_price,
    iv.selling_price
FROM v_inventory_value iv
WHERE iv.quantity_on_hand <= iv.reorder_point
  AND iv.is_active = 1;
