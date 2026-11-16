-- StockIQ Database Stored Procedures
-- Target: MySQL 8 / MariaDB 10.11

DELIMITER $$

DROP PROCEDURE IF EXISTS `sp_reconcile_inventory`$$

CREATE PROCEDURE `sp_reconcile_inventory`()
BEGIN
    -- Reconciles current inventory balances against the append-only stock_movements ledger.
    -- Returns only rows where a discrepancy exists between inventory.quantity and
    -- the cumulative sum of stock_movements.quantity_change for that product and warehouse.
    -- Zero rows returned indicates 100% ledger integrity.
    SELECT 
        i.product_id,
        p.sku,
        p.name AS product_name,
        i.warehouse_id,
        w.name AS warehouse_name,
        i.quantity AS inventory_quantity,
        COALESCE(m.ledger_quantity, 0) AS ledger_quantity,
        (i.quantity - COALESCE(m.ledger_quantity, 0)) AS discrepancy
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
    WHERE i.quantity != COALESCE(m.ledger_quantity, 0)
    ORDER BY i.product_id;
END$$

DELIMITER ;
