-- 01_supplier_product_report.sql
-- Report: Multi-table JOIN linking Products, Categories, Suppliers, and ProductSupplier relations.
-- Surfaces primary vs secondary suppliers, negotiated unit costs, lead times, and MOQs.
-- Handles NULL lead times and MOQs safely without data loss.

SELECT 
    p.sku AS product_sku,
    p.name AS product_name,
    c.name AS category_name,
    s.name AS supplier_name,
    s.contact_name AS supplier_contact,
    s.email AS supplier_email,
    ps.is_preferred AS is_primary_supplier,
    COALESCE(ps.unit_cost, p.cost_price) AS contract_unit_cost,
    p.selling_price AS retail_price,
    ROUND(((p.selling_price - COALESCE(ps.unit_cost, p.cost_price)) / p.selling_price) * 100, 1) AS target_margin_pct,
    COALESCE(CONCAT(ps.lead_time_days, ' days'), 'Unspecified') AS lead_time,
    COALESCE(CONCAT(ps.min_order_qty, ' ', p.unit), 'No minimum') AS min_order_qty
FROM products p
JOIN categories c ON p.category_id = c.id
JOIN product_suppliers ps ON p.id = ps.product_id
JOIN suppliers s ON ps.supplier_id = s.id
WHERE p.is_active = 1
  AND s.is_active = 1
ORDER BY 
    c.name ASC,
    p.name ASC,
    ps.is_preferred DESC,
    contract_unit_cost ASC;
