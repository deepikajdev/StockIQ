# Antigravity prompt — Phase 1: Database layer

You are working in the `stockiq/` repo. The FastAPI backend already exists in `backend/` and its SQLAlchemy
models in `backend/app/models.py` are the source of truth for tables. Target DB: MySQL 8 (dev may be MariaDB 10.11).
Do NOT rename or change existing tables/columns without listing every change at the end of your reply.

## Deliverables (put in `db/`)
1. `db/schema.sql` — hand-written MySQL 8 DDL equivalent to models.py: PKs, FKs, UNIQUE, CHECK, indexes,
   utf8mb4, InnoDB, DECIMAL for money. Verify it loads on an empty DB and matches what SQLAlchemy creates
   (compare `SHOW CREATE TABLE`).
2. `db/views.sql` — at least:
   - `v_inventory_value` (product, qty, cost, stock value)
   - `v_low_stock` (qty <= reorder_point)
   - `v_daily_sales` (date, sales count, units, revenue; completed sales only)
   - `v_product_sales_30d` (units sold per product, last 30 days, cancelled sales excluded)
3. `db/routines.sql` — ONE stored procedure `sp_reconcile_inventory()` that returns rows where
   `inventory.quantity` != SUM(stock_movements.quantity_change). Do not re-implement sale/purchase logic in SQL
   (the app owns that — no duplicated business logic).
4. `db/triggers.sql` — triggers that block UPDATE and DELETE on `stock_movements` (append-only ledger).
5. `db/seed.py` (Python, uses the app's SQLAlchemy session + `app.services.stock.change_stock`) —
   believable stationery-shop dataset: 8 categories, 40 products with realistic prices/cost, 6 suppliers with
   product links (some with unknown lead time / MOQ — leave NULL, never invent), opening balances, 6 purchases
   received over the last 8 weeks, and ~8 weeks of daily sales with realistic variation (some fast movers,
   some slow movers, 3–4 products deliberately near/below reorder point, 2 products with zero sales in 60 days,
   1 product with <7 days of history). Sales must go through `change_stock` so ledger == inventory. Backdate
   `sold_at` / `created_at`. Idempotent: refuse to run if products already exist unless `--reset`.
6. `db/queries/` — numbered .sql files showing: JOIN supplier/product report, GROUP BY sales by category,
   top 10 products by revenue, inventory valuation, and a before/after `EXPLAIN` demonstration of an index
   (e.g. drop/create `ix_si_product` and show the plan change on the 30-day sales query).
7. `db/transaction_demo.sql` — a runnable demo: BEGIN; deduct stock for two lines where the second line fails;
   ROLLBACK; show nothing changed.
8. `docs/database.md` — Mermaid ER diagram with cardinalities, data dictionary (table, column, type, why),
   normalization walkthrough (1NF→3NF with examples, and the deliberate denormalization: sale_items.unit_cost
   and unit_price are snapshots), and an explanation of the locking strategy (SELECT ... FOR UPDATE in
   `change_stock`, row-lock ordering by product_id).
9. `db/backup.md` — mysqldump backup + restore commands.

## Acceptance
- `mysql < db/schema.sql && mysql < db/views.sql && mysql < db/routines.sql && mysql < db/triggers.sql` succeed on empty DB.
- After `python db/seed.py` then `CALL sp_reconcile_inventory()` returns zero rows.
- Backend tests still pass: `cd backend && pytest`. (NOTE: the append-only triggers must not break them.)
- Money never FLOAT. All timestamps UTC.
