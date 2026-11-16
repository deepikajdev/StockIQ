-- 05_index_demonstration.sql
-- Performance Demonstration: Demonstrates the optimizer impact of the index `ix_si_product`
-- on the trailing 30-day product sales aggregation query.
--
-- Background:
-- When querying product sales (as in v_product_sales_30d), the query joins products p to sale_items si.
-- In MySQL InnoDB, an index supporting a foreign key cannot be dropped without first dropping the FK
-- constraint (Error 1553: Cannot drop index 'ix_si_product': needed in a foreign key constraint).
-- This script safely drops the FK constraint, drops ix_si_product, benchmarks the EXPLAIN plan,
-- and then completely restores the index and foreign key.

-- ============================================================================
-- STEP 1: Benchmark Query with Index ACTIVE
-- ============================================================================
-- Notice: MySQL optimizer utilizes index access paths.

EXPLAIN
SELECT 
    p.id AS product_id,
    p.sku,
    p.name AS product_name,
    COALESCE(SUM(si.quantity), 0) AS units_sold,
    COALESCE(SUM(si.quantity * si.unit_price), 0.00) AS revenue
FROM products p
JOIN sale_items si ON p.id = si.product_id
JOIN sales s ON si.sale_id = s.id
WHERE s.status <> 'cancelled'
  AND s.sold_at >= (NOW() - INTERVAL 30 DAY)
GROUP BY p.id, p.sku, p.name;

-- ============================================================================
-- STEP 2: DROP FK and DROP the Index to Demonstrate Plan Degradation
-- ============================================================================
ALTER TABLE sale_items DROP FOREIGN KEY fk_si_product;
ALTER TABLE sale_items DROP INDEX ix_si_product;

-- ============================================================================
-- STEP 3: Benchmark Query with Index DROPPED
-- ============================================================================
-- Notice: With ix_si_product absent, possible_keys on si shows only ix_si_sale.
-- MySQL cannot look up sale_items by product_id directly.

EXPLAIN
SELECT 
    p.id AS product_id,
    p.sku,
    p.name AS product_name,
    COALESCE(SUM(si.quantity), 0) AS units_sold,
    COALESCE(SUM(si.quantity * si.unit_price), 0.00) AS revenue
FROM products p
JOIN sale_items si ON p.id = si.product_id
JOIN sales s ON si.sale_id = s.id
WHERE s.status <> 'cancelled'
  AND s.sold_at >= (NOW() - INTERVAL 30 DAY)
GROUP BY p.id, p.sku, p.name;

-- ============================================================================
-- STEP 4: RESTORE the Index and Foreign Key Constraint
-- ============================================================================
ALTER TABLE sale_items ADD INDEX ix_si_product (product_id);
ALTER TABLE sale_items ADD CONSTRAINT fk_si_product FOREIGN KEY (product_id) REFERENCES products (id);

-- ============================================================================
-- STEP 5: Verify Index Restoration and Optimal Query Plan
-- ============================================================================
EXPLAIN FORMAT=TREE
SELECT 
    p.id AS product_id,
    p.sku,
    p.name AS product_name,
    COALESCE(SUM(si.quantity), 0) AS units_sold,
    COALESCE(SUM(si.quantity * si.unit_price), 0.00) AS revenue
FROM products p
JOIN sale_items si ON p.id = si.product_id
JOIN sales s ON si.sale_id = s.id
WHERE s.status <> 'cancelled'
  AND s.sold_at >= (NOW() - INTERVAL 30 DAY)
GROUP BY p.id, p.sku, p.name;
