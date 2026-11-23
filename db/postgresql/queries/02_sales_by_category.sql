-- 02_sales_by_category.sql (PostgreSQL)
-- Aggregation Report: GROUP BY Category analyzing sales performance.
-- Computes order counts, total units sold, gross revenue, product cost of goods sold (COGS),
-- net margin, and average sales price per unit.
-- Restricts to completed sales transactions.

SELECT
    c.id AS category_id,
    c.name AS category_name,
    COUNT(DISTINCT s.id) AS completed_orders_count,
    COUNT(si.id) AS total_line_items,
    COALESCE(SUM(si.quantity), 0) AS total_units_sold,
    COALESCE(SUM(si.quantity * si.unit_price), 0.00) AS total_gross_revenue,
    COALESCE(SUM(si.quantity * si.unit_cost), 0.00) AS total_cogs,
    COALESCE(SUM(si.quantity * (si.unit_price - si.unit_cost)), 0.00) AS total_gross_margin,
    ROUND(
        (SUM(si.quantity * (si.unit_price - si.unit_cost)) / NULLIF(SUM(si.quantity * si.unit_price), 0)) * 100,
        2
    ) AS margin_percentage,
    ROUND(
        SUM(si.quantity * si.unit_price) / NULLIF(SUM(si.quantity), 0),
        2
    ) AS avg_selling_price_per_unit
FROM categories c
JOIN products p ON c.id = p.category_id
JOIN sale_items si ON p.id = si.product_id
JOIN sales s ON si.sale_id = s.id
WHERE s.status = 'completed'
GROUP BY c.id, c.name
ORDER BY total_gross_revenue DESC;
