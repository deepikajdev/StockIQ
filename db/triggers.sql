-- StockIQ Database Triggers
-- Target: MySQL 8 / MariaDB 10.11
-- Enforces the append-only invariant on stock_movements ledger at the database level.
-- Prohibits UPDATE and DELETE operations during regular application processing.
-- An administrative maintenance bypass (@STOCKIQ_ALLOW_LEDGER_MUTATION = 1) is reserved
-- exclusively for seed initialization / test fixture resets.

DELIMITER $$

DROP TRIGGER IF EXISTS `trg_stock_movements_no_update`$$

CREATE TRIGGER `trg_stock_movements_no_update`
BEFORE UPDATE ON `stock_movements`
FOR EACH ROW
BEGIN
    IF @STOCKIQ_ALLOW_LEDGER_MUTATION IS NULL OR @STOCKIQ_ALLOW_LEDGER_MUTATION != 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Stock movement ledger is append-only: UPDATE is strictly prohibited';
    END IF;
END$$

DROP TRIGGER IF EXISTS `trg_stock_movements_no_delete`$$

CREATE TRIGGER `trg_stock_movements_no_delete`
BEFORE DELETE ON `stock_movements`
FOR EACH ROW
BEGIN
    IF @STOCKIQ_ALLOW_LEDGER_MUTATION IS NULL OR @STOCKIQ_ALLOW_LEDGER_MUTATION != 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Stock movement ledger is append-only: DELETE is strictly prohibited';
    END IF;
END$$

DELIMITER ;
