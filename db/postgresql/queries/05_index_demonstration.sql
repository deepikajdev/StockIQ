-- 05_index_demonstration.sql (PostgreSQL)
-- Performance Demonstration: demonstrates the optimizer impact of the index ix_si_product
-- on the trailing 30-day product sales aggregation query.
--
-- MySQL's ALTER TABLE ... DROP FOREIGN KEY / DROP INDEX / ADD INDEX syntax is
-- replaced with PostgreSQL's DROP CONSTRAINT / DROP INDEX / CREATE INDEX.
-- EXPLAIN FORMAT=TREE becomes plain EXPLAIN (or EXPLAIN (FORMAT JSON)).

-- ===========================================================================
-- STEP 1: Benchmark Query with Index ACTIVE
-- ===========================================================================
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
  AND s.sold_at >= (CURRENT_TIMESTAMP - INTERVAL '30 days')
GROUP BY p.id, p.sku, p.name;

-- ===========================================================================
-- STEP 2: DROP FK and DROP the Index to Demonstrate Plan Degradation
-- ===========================================================================
ALTER TABLE sale_items DROP CONSTRAINT fk_si_product;
DROP INDEX IF EXISTS ix_si_product;

-- ===========================================================================
-- STEP 3: Benchmark Query with Index DROPPED
-- ===========================================================================
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
  AND s.sold_at >= (CURRENT_TIMESTAMP - INTERVAL '30 days')
GROUP BY p.id, p.sku, p.name;

-- ===========================================================================
-- STEP 4: RESTORE the Index and Foreign Key Constraint
-- ===========================================================================
CREATE INDEX ix_si_product ON sale_items (product_id);
ALTER TABLE sale_items
    ADD CONSTRAINT fk_si_product FOREIGN KEY (product_id) REFERENCES products (id);

-- ===========================================================================
-- STEP 5: Verify Index Restoration and Query Plan
-- ===========================================================================
EXPLAIN (FORMAT JSON)
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
  AND s.sold_at >= (CURRENT_TIMESTAMP - INTERVAL '30 days')
GROUP BY p.id, p.sku, p.name;
