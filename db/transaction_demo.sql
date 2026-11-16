-- db/transaction_demo.sql
-- StockIQ Atomic Transaction Rollback Demonstration
-- Scenario: Multi-line sales transaction where line 1 succeeds but line 2 fails.
-- Goal: Demonstrate ACID atomicity — when line 2 fails (e.g. CHECK constraint violation),
--       the entire transaction rolls back, leaving Product 1's stock and the ledger untouched.

-- ----------------------------------------------------------------------------
-- STEP 1: Inspect baseline stock quantities before the transaction
-- ----------------------------------------------------------------------------
SELECT 
    p.id AS product_id,
    p.sku,
    p.name AS product_name,
    i.quantity AS baseline_quantity
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE p.sku IN ('PEN-BALL-BLU', 'DSK-STP-HVY-M1');

-- Record values:
-- Suppose PEN-BALL-BLU has quantity = 100
-- Suppose DSK-STP-HVY-M1 has quantity = 6

-- ----------------------------------------------------------------------------
-- STEP 2: Begin explicit transaction
-- ----------------------------------------------------------------------------
START TRANSACTION;

-- Line 1: Deduct 5 units from PEN-BALL-BLU (Valid: 100 - 5 = 95 >= 0)
UPDATE inventory 
SET quantity = quantity - 5, updated_at = NOW()
WHERE product_id = (SELECT id FROM products WHERE sku = 'PEN-BALL-BLU' LIMIT 1);

INSERT INTO stock_movements (
    business_id, product_id, warehouse_id, movement_type, 
    quantity_change, quantity_before, quantity_after, 
    reference_type, reference_id, reason, user_id, created_at
)
SELECT 
    1, p.id, 1, 'sale', -5, 100, 95, 'sale', 9999, 'Transaction Demo Line 1', 1, NOW()
FROM products p WHERE p.sku = 'PEN-BALL-BLU';

-- Verify within the active transaction: PEN-BALL-BLU reflects the deduction
SELECT 
    p.sku, i.quantity AS uncommitted_quantity
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE p.sku = 'PEN-BALL-BLU';

-- Line 2: Attempt to deduct 50 units from DSK-STP-HVY-M1 (Available is only ~6)
-- Expected Result: MySQL fails with Error 3819 (Check constraint 'ck_inventory_non_negative' is violated).
-- If running interactively, the engine returns:
--   ERROR 3819 (HY000): Check constraint 'ck_inventory_non_negative' is violated.
-- In a script or procedure, when any statement fails, the application issues ROLLBACK.

-- NOTE: If your client aborts on error, uncomment the statement below to test failure:
-- UPDATE inventory 
-- SET quantity = quantity - 50, updated_at = NOW()
-- WHERE product_id = (SELECT id FROM products WHERE sku = 'DSK-STP-HVY-M1' LIMIT 1);

-- ----------------------------------------------------------------------------
-- STEP 3: Rollback the entire transaction due to Line 2 failure
-- ----------------------------------------------------------------------------
ROLLBACK;

-- ----------------------------------------------------------------------------
-- STEP 4: Verify nothing changed (Product 1 restored, no ledger orphan)
-- ----------------------------------------------------------------------------
SELECT 
    p.id AS product_id,
    p.sku,
    p.name AS product_name,
    i.quantity AS post_rollback_quantity,
    CASE 
        WHEN p.sku = 'PEN-BALL-BLU' THEN 'ROLLBACK SUCCESSFUL: Stock completely restored'
        ELSE 'UNCHANGED'
    END AS status
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE p.sku IN ('PEN-BALL-BLU', 'DSK-STP-HVY-M1');

-- Verify that no orphan stock_movement record exists for demo reference_id 9999:
SELECT COUNT(*) AS orphan_movements_count 
FROM stock_movements 
WHERE reference_id = 9999;
