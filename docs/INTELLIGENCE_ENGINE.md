# StockIQ Intelligence Engine (Phase 3)

**Status:** implemented, read-only, rule-based. **This is not machine learning.**
No model is trained, no weights are fitted, and no accuracy is claimed. Every
number is produced by a documented formula over data that already exists in the
database.

The engine never writes to the database, never creates a purchase order, and
never invents sales history. All suggestions require a human to review and
confirm them in the existing Purchases workflow.

---

## 1. Data sources (existing tables only — no schema changes)

| Input | Source | Notes |
|---|---|---|
| Units sold | `sale_items.quantity` joined to `sales` | Only `sales.status = 'completed'`; cancelled sales are excluded. Grouped by product and calendar day in **one** SQL query. |
| On-hand stock | `inventory.quantity` | Restricted to the business's **default warehouse**, matching `GET /inventory` and all stock mutations. No ledger writes. |
| Product parameters | `products.reorder_point`, `products.safety_stock`, `products.is_active`, `products.cost_price` | The manual reorder point is preserved as a floor. |
| Supplier parameters | `product_suppliers` + `suppliers` | Preferred active supplier first, then the cheapest active alternative. `lead_time_days`, `min_order_qty` and `unit_cost` are read, never guessed silently. |
| "Enough history" check | Completed sales **and** `stock_movements.created_at` | A product is considered to have enough history when it has any completed sale or stock movement at least `MIN_HISTORY_DAYS` before today. Activity dates never add units to a forecast. |
| Category fallback | All products in the same `categories.id` | Used only for products with some demand but fewer than `MIN_HISTORY_DAYS` of activity. |

Cross-tenant isolation is enforced on every query with `business_id`.

---

## 2. Baseline demand model

`recency_weighted_moving_average` over a calendar window of `LOOKBACK_DAYS`
(default 30). Days with no sales count as **zero units** — they are not dropped.

```
offset 0-6 days ago   -> weight 3
offset 7-20 days ago  -> weight 2
offset 21-29 days ago -> weight 1

weighted_daily_demand = Σ(units_day × weight_day) / Σ(weight_day)
avg_daily_demand      = units_sold_in_window / LOOKBACK_DAYS
```

The band boundaries scale with `LOOKBACK_DAYS`, preserving the 7/14/9-day
proportions of the default 30-day window.

### Fallback ladder (reported explicitly via `forecast.method`)

| Situation | Method | Demand |
|---|---|---|
| Enough history | `recency_weighted_moving_average` | Weighted daily demand |
| Sparse history, category has sales | `category_average_fallback` | Category's average daily demand |
| Sparse history, no category sales, some own sales | `simple_average_fallback` | Product's own average daily demand |
| **Zero units sold in the window** | `no_recent_sales_zero_baseline` | **0** — never imputed from the category |
| No data at all | `no_history_zero_baseline` | 0 |

A zero-sales product is deliberately *not* given a category-based estimate: that
would invent product demand and could trigger a purchase order for dead stock.

`forecast.is_machine_learning` is always `false`.

---

## 3. Stockout prediction

```
days_until_stockout = current_stock / daily_demand        (null when demand = 0)
```

| Condition | `stockout_risk` |
|---|---|
| No stock, or cover < lead time | `critical` |
| cover < 2 × lead time | `high` |
| cover < 4 × lead time | `medium` |
| otherwise | `low` |
| demand = 0 | `none` |

`will_stockout_before_reorder` is true when cover is shorter than the supplier
lead time. `lead_time_is_assumed` is true when no supplier is linked; the UI
discloses this assumption and blocks confident ordering language.

---

## 4. Reorder recommendation

```
calculated_reorder_point = ceil(daily_demand × lead_time_days) + safety_stock
effective_reorder_point  = max(calculated_reorder_point, manual reorder_point)
target_stock             = ceil(daily_demand × (lead_time_days + REVIEW_PERIOD_DAYS))
                           + safety_stock
needs_reorder            = current_stock <= effective_reorder_point
suggested_qty            = needs_reorder
                           ? max(MOQ, ceil(target_stock - current_stock))
                           : 0
```

MOQ adjustments are reported as `explanation_details.adjusted_for_moq`.
Cost estimates use `product_suppliers.unit_cost`; when it is NULL the estimate
is NULL rather than an invented price.

### Explanations

Each recommendation carries two complementary forms:

- `explanation`: human-readable, numbered-by-step strings for the UI.
- `explanation_details`: a typed object with lookback window, units sold,
  observed vs. planning demand, stock, lead time and its source, safety stock,
  review period, both reorder points, target stock, suggested quantity, MOQ
  adjustment flag, substituted formula strings, and the disclaimer
  *"Estimate based on recent sales; not a guarantee."*

---

## 5. Inventory risk scoring

Deterministic 0–100 score with a category, reasons and an action:

| Category | Trigger (evaluated in order) | Meaning |
|---|---|---|
| `critical` | No stock with positive demand, or cover < lead time | Immediate attention |
| `dead_stock` | Stock > 0 and zero units sold in window | Stop replenishing; clearance review |
| `slow_moving` | Demand < 0.1 units/day | Reduce order frequency / promote |
| `excess` | Cover > 90 days | Capital tied up; pause replenishment |
| `low_stock` | Stock ≤ effective reorder point | Reorder at next review |
| `healthy` | Everything else | No action |

Scores are internal priorities, not probabilities. The UI shows the category,
the score, the reasons and the recommended action.

---

## 6. Endpoints

All endpoints are authenticated (`Depends(current_user)`), read-only, scoped to
`user.business_id`, and validated with Pydantic `response_model`s. Staff and
admin can read them.

| Method | Path | Purpose |
|---|---|---|
| GET | `/intelligence/summary?risk_category=` | Full analysis for every active product, sorted by urgency |
| GET | `/intelligence/reorder-recommendations` | Only products needing replenishment |
| GET | `/intelligence/risk?risk_category=` | Risk register; category query param is validated (422 if invalid) |
| GET | `/intelligence/products/{id}` | One product: demand, stockout, reorder, risk |
| GET | `/intelligence/products/{id}/forecast?history_days=&forecast_days=` | Daily actuals + baseline projection for charts |
| GET | `/intelligence/evaluation` | Time-based holdout metrics and limitations |

Example (abridged) response for `/intelligence/reorder-recommendations`:

```json
{
  "generated_at": "2026-11-21T09:00:00",
  "window_days": 30,
  "algorithm": "recency_weighted_moving_average",
  "total": 1,
  "items": [{
    "product_id": 1,
    "sku": "FAST-1",
    "name": "Fast Mover",
    "current_stock": 5,
    "forecast": {
      "daily_demand": 2.0,
      "forecast_7d_units": 14.0,
      "method": "recency_weighted_moving_average",
      "is_machine_learning": false
    },
    "stockout_prediction": {
      "days_until_stockout": 2.5,
      "stockout_risk": "critical",
      "lead_time_days": 7,
      "lead_time_is_assumed": false
    },
    "reorder_recommendation": {
      "needs_reorder": true,
      "effective_reorder_point": 24,
      "reorder_qty": 50,
      "explanation_details": {
        "units_sold": 60,
        "lead_time_source": "Test Supplier",
        "adjusted_for_moq": true,
        "disclaimer": "Estimate based on recent sales; not a guarantee."
      }
    }
  }]
}
```

The full schema is generated in `docs/openapi.json` and visible at `/docs`.

---

## 7. Evaluation

`GET /intelligence/evaluation` performs a **time-based holdout** (no
random splitting, no leakage from the future into the training window):

- Train window: the most recent `LOOKBACK_DAYS` days before the holdout.
- Test window: the following 14 days.
- Model: the same recency-weighted average used in production.
- Baseline: the naive mean daily demand over the same training window.
- Only products with sales in the combined window are evaluated.
- Metrics: **MAE** (mean absolute error in units/day) and **WAPE**
  (sum of absolute errors / sum of actual units, `null` when actuals are zero).
- Per-product errors and which estimator was better are included.

`model_beats_naive_baseline` reports the observed result on this single split;
it is **not** evidence of generalisation or of ML performance.

### Documented data limitations

1. Single time-based holdout, not rolling-origin cross-validation.
2. Deterministic rule-based estimator, not a trained model.
3. No seasonality, promotions, price effects or stockout-censored demand.
4. Sparse-product category fallbacks are excluded from the holdout comparison.
5. Supplier lead-time variability is not modelled; stockout dates are estimates.
6. WAPE is undefined when the test window has zero actual units.
7. Cancelled sales are excluded from both training and evaluation.

---

## 8. Configuration

Environment variables (see `backend/.env.example`):

| Variable | Default | Meaning |
|---|---|---|
| `LOOKBACK_DAYS` | 30 | Calendar days in the demand window |
| `REVIEW_PERIOD_DAYS` | 7 | Extra cover requested when replenishing |
| `MIN_HISTORY_DAYS` | 7 | Age of earliest sale/movement required for "enough history" |

Changing these changes the rules, not a trained model. No database migration is
required.

---

## 9. Frontend integration

- `src/api/intelligence.ts` — typed read-only API wrapper.
- `src/types/index.ts` — response types mirroring the Pydantic schemas.
- `src/utils/intelligence.ts` — pure label/format helpers (unit tested).
- `src/components/intelligence/` — risk badge and Recharts demand chart.
- `AlertsReorder.tsx` — live reorder queue, demand basis, days to stockout,
  supplier/MOQ details, and a drawer with the full explanation. A confirmation
  modal must be accepted before navigating to Purchases; nothing is ordered.
- `Reports.tsx` — Demand & Risk tab with forecast chart, evaluation metrics,
  limitations, risk register, and API-backed dead-stock diagnostics.
- `ProductDetail.tsx` — per-product demand forecast, risk reasoning and
  reorder explanation.

The previous client-side fabrication (`avgSales` derived from `reorder_point`,
hard-coded `Primary Vendor` / 7-day lead time) was removed.

---

## 10. Safety and verification

- No `INSERT`/`UPDATE`/`DELETE` in any intelligence query; the no-mutation test
  asserts sale counts are unchanged after calling every endpoint.
- Tenant isolation is asserted with a second business and a cross-tenant 404.
- Zero-sales products are asserted to have zero demand and no reorder qty.
- MOQ, warehouse scope, structured explanations and validated risk filters are
  covered by tests.

Run:

```bash
cd backend && python -m pytest tests/test_intelligence.py -q
cd frontend && npm run typecheck && npm test && npm run build
```

The remaining `backend/tests/test_stock_workflows.py` suite requires a running test
database (MySQL or PostgreSQL via `DATABASE_URL` plus matching `STOCKIQ_TEST_DB`); those tests
are unchanged by this work. PostgreSQL integration coverage is gated on the dedicated local
`stockiq_pg_test` database in `tests/test_postgresql_integration.py`.
