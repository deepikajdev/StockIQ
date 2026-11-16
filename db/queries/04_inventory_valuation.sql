-- 04_inventory_valuation.sql
-- Financial Valuation Report: Aggregates warehouse inventory by product category.
-- Computes total physical units on hand, total inventory investment (Cost Valuation),
-- potential retail yield (Retail Valuation), and unrealized profit.
-- Includes a grand total ROLLUP row for executive accounting balance sheets.

SELECT 
    COALESCE(c.name, '*** ALL CATEGORIES GRAND TOTAL ***') AS category,
    COUNT(DISTINCT p.id) AS active_products_count,
    SUM(COALESCE(i.quantity, 0)) AS total_units_in_stock,
    SUM(ROUND(COALESCE(i.quantity, 0) * p.cost_price, 2)) AS inventory_cost_value,
    SUM(ROUND(COALESCE(i.quantity, 0) * p.selling_price, 2)) AS inventory_retail_value,
    SUM(ROUND(COALESCE(i.quantity, 0) * (p.selling_price - p.cost_price), 2)) AS potential_gross_profit,
    ROUND(
        (SUM(COALESCE(i.quantity, 0) * (p.selling_price - p.cost_price)) / 
         NULLIF(SUM(COALESCE(i.quantity, 0) * p.selling_price), 0)) * 100,
        2
    ) AS unrealized_margin_pct
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN inventory i ON p.id = i.product_id
WHERE p.is_active = 1
GROUP BY c.name WITH ROLLUP;
