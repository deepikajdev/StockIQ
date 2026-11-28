-- 03_top_10_products_by_revenue.sql (PostgreSQL)
-- Performance Ranking: Top 10 revenue-generating products across completed sales.
-- Uses DENSE_RANK() window function to display leaderboard position.
-- Accurately calculates historical profitability based on snapshotted sale_items unit_cost.

WITH product_revenue AS (
    SELECT
        p.id AS product_id,
        p.sku,
        p.name AS product_name,
        c.name AS category_name,
        p.unit,
        SUM(si.quantity) AS total_units_sold,
        SUM(si.quantity * si.unit_price) AS total_revenue,
        SUM(si.quantity * si.unit_cost) AS total_cost,
        SUM(si.quantity * (si.unit_price - si.unit_cost)) AS total_profit,
        ROUND(
            (SUM(si.quantity * (si.unit_price - si.unit_cost)) / NULLIF(SUM(si.quantity * si.unit_price), 0)) * 100,
            2
        ) AS profit_margin_pct
    FROM products p
    JOIN categories c ON p.category_id = c.id
    JOIN sale_items si ON p.id = si.product_id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'completed'
    GROUP BY p.id, p.sku, p.name, c.name, p.unit
)
SELECT
    DENSE_RANK() OVER (ORDER BY total_revenue DESC) AS sales_rank,
    sku,
    product_name,
    category_name,
    CONCAT(total_units_sold, ' ', unit) AS volume_sold,
    total_revenue,
    total_cost,
    total_profit,
    CONCAT(profit_margin_pct, CHR(37)) AS margin
FROM product_revenue
ORDER BY sales_rank ASC
LIMIT 10;
