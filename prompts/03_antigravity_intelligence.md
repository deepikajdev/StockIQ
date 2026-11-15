# Antigravity prompt — Phase 3: Inventory intelligence, reports, test hardening

Repo: `stockiq/`. Backend (FastAPI + SQLAlchemy + MySQL) is in `backend/`. Auth, products, suppliers,
purchases, sales, inventory, adjustments and movements are DONE and tested — read `backend/app/routers/*.py`,
`app/services/stock.py`, `app/models.py` and `tests/conftest.py` first and FOLLOW THE SAME PATTERNS
(routers → services, `Depends(current_user)`, scoping every query by `user.business_id`, `Page[T]` for lists,
Decimal money, UTC naive datetimes). Do not touch the stock-change path.

## Business rules (from the PRD — transparent formulas, NO ML, never invent data)
Config defaults in `app/config.py` (env-overridable): LOOKBACK_DAYS=30, REVIEW_PERIOD_DAYS=7, MIN_HISTORY_DAYS=7.
- units sold = SUM(sale_items.quantity) over sales with status='completed' in the window (cancelled excluded).
- avg_daily_sales = units_sold / LOOKBACK_DAYS (calendar days in window).
- "enough history" = the product has a completed sale OR stock movement older than MIN_HISTORY_DAYS; otherwise
  state `insufficient_history`.
- days_remaining = current_stock / avg_daily_sales; if avg_daily_sales == 0 → null + status `no_recent_sales`.
- lead_time = lead_time_days from the product's preferred supplier (else the supplier with the shortest known
  lead time); if none known → status `missing_lead_time` (do not guess).
- reorder_point = ceil(avg_daily_sales * lead_time_days) + safety_stock.
  Also keep the product's manual `reorder_point` as a floor: effective_reorder_point = max(calculated, manual).
  Return both so the UI can show which one applied.
- low-stock alert: current_stock <= effective_reorder_point.
- target_stock = ceil(avg_daily_sales * (lead_time_days + REVIEW_PERIOD_DAYS)) + safety_stock
- suggested_qty = max(0, target_stock - current_stock); then if the chosen supplier has min_order_qty and
  suggested_qty > 0 → raise to at least MOQ. Return `adjusted_for_moq: bool`.
- Every recommendation response MUST include an `explanation` object: lookback_days, window_start, window_end,
  units_sold, avg_daily_sales, current_stock, lead_time_days, lead_time_source (supplier name),
  safety_stock, review_period_days, reorder_point_calculated, reorder_point_manual, target_stock,
  suggested_qty, formula strings (human-readable with the numbers substituted), and `disclaimer`:
  "Estimate based on recent sales; not a guarantee."

## Endpoints to add (all authenticated; all roles can read)
- `GET /alerts/low-stock?limit&offset` → products at/below effective reorder point, sorted by urgency
  (days_remaining ascending, nulls last).
- `GET /analytics/stockout?product_id=&limit&offset` → per product: status
  (`ok|no_recent_sales|insufficient_history|missing_lead_time`), days_remaining, avg_daily_sales, inputs.
- `GET /recommendations/reorder?limit&offset` → only products where suggested_qty > 0 or status needs attention,
  each with the explanation object and `supplier` (id, name, unit_cost) to prefill a purchase.
- `GET /reports/sales?date_from&date_to&group_by=day|week|month` → totals (revenue, units, sale count, gross margin
  using sale_items.unit_cost snapshot) + series + `top_products` (top 10 by revenue). Exclude cancelled sales.
- `GET /reports/inventory` → stock on hand count, total estimated inventory value (qty × cost_price),
  low-stock items, per-category summary.
- `GET /reports/dead-stock?days=60` (Phase-2 feature FR-16, include it) → active products with stock>0 and no
  completed sale in N days.
- `GET /dashboard/summary` → active_products, stock_value, low_stock_count, sales_today, revenue_today,
  revenue_7d, recent_sales (last 5), top 5 low-stock items.
Put logic in `app/services/intelligence.py` and `app/services/reports.py` (pure functions taking a Session,
so they are unit-testable); routers stay thin. Avoid N+1 queries: compute units sold per product with ONE
grouped query.

## Tests (`backend/tests/`)
Add `test_intelligence.py` and `test_reports.py` covering the PRD scenarios: alert at / below / above reorder
point; stockout with positive, zero and insufficient sales history; reorder with known lead time + safety
stock (assert exact numbers); MOQ raising; missing lead time → no fabricated number; cancelled sales excluded;
staff can read but unauthenticated gets 401; reports correct on seeded data. To create backdated sales in tests,
insert via the session using `change_stock` then update `sold_at`. Keep all existing tests green.

## Done when
`cd backend && pytest` is green, `/docs` (Swagger) shows the new endpoints with typed response models, and
`docs/api-contract.md` documents each new request/response with a JSON example.
