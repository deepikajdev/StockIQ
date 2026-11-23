-- StockIQ Database Triggers (PostgreSQL)
-- PostgreSQL equivalent of db/triggers.sql. MySQL support remains in the original file.
--
-- Enforces the append-only invariant on stock_movements at the database level.
-- Regular UPDATE/DELETE statements are rejected with SQLSTATE 45000. Seed and
-- fixture maintenance may temporarily opt in with:
--   SELECT set_config('stockiq.allow_ledger_mutation', '1', false);
-- and must reset it with the same call using '0'.
--
-- This file also implements MySQL's ON UPDATE CURRENT_TIMESTAMP behavior for
-- products.updated_at and inventory.updated_at.

CREATE OR REPLACE FUNCTION trg_stock_movements_no_update_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF COALESCE(current_setting('stockiq.allow_ledger_mutation', true), '') <> '1' THEN
        RAISE EXCEPTION
            'Stock movement ledger is append-only: UPDATE is strictly prohibited'
            USING ERRCODE = '45000';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_stock_movements_no_delete_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF COALESCE(current_setting('stockiq.allow_ledger_mutation', true), '') <> '1' THEN
        RAISE EXCEPTION
            'Stock movement ledger is append-only: DELETE is strictly prohibited'
            USING ERRCODE = '45000';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movements_no_update ON stock_movements;
CREATE TRIGGER trg_stock_movements_no_update
BEFORE UPDATE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION trg_stock_movements_no_update_fn();

DROP TRIGGER IF EXISTS trg_stock_movements_no_delete ON stock_movements;
CREATE TRIGGER trg_stock_movements_no_delete
BEFORE DELETE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION trg_stock_movements_no_delete_fn();

-- ---------------------------------------------------------------------------
-- ON UPDATE CURRENT_TIMESTAMP equivalent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_set_updated_at ON products;
CREATE TRIGGER trg_products_set_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_fn();

DROP TRIGGER IF EXISTS trg_inventory_set_updated_at ON inventory;
CREATE TRIGGER trg_inventory_set_updated_at
BEFORE UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_fn();
