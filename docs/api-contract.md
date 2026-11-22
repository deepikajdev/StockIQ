# StockIQ API contract (v1)

Base URL: `VITE_API_URL` (dev: http://localhost:8000). Interactive docs are available at `/docs`
only when `DOCS_ENABLED=true` (default in development, disabled in production). The OpenAPI
schema at `/openapi.json` is controlled independently by `OPENAPI_ENABLED`.

**Auth:** `POST /auth/login {email,password}` → `{access_token, token_type, user:{id,email,full_name,role,business_id}}`.
Send `Authorization: Bearer <token>` on everything else. Roles: `admin`, `staff`.

**Conventions**
- Lists return `{items, total, limit, offset}`; query with `limit` (1–200) and `offset`.
- Money is a decimal **string** (e.g. `"40.00"`). Quantities are integers. Timestamps are UTC ISO-8601 (no zone suffix) — convert to local time in the UI.
- Errors: `{"detail": "..."}`; validation errors 422 with a `detail` array. Insufficient stock → **409** with
  `detail: {code:"insufficient_stock", message, product_id, available, requested}`.
- Staff can: read everything, create sales, receive existing purchases. Everything else that writes is admin-only (403).
- Stock changes ONLY via purchases (receive), sales, and `POST /inventory/adjustments`. Initial stock = an `opening_balance` adjustment.

**Purchases:** `POST /purchases {supplier_id, items:[{product_id,quantity,unit_cost}], notes?, receive_now?}` → draft (or received).
`POST /purchases/{id}/receive`, `POST /purchases/{id}/cancel` (received purchases are reversed if stock allows).
**Sales:** `POST /sales {items:[{product_id,quantity}], customer_name?}` — price comes from the product on the server. `POST /sales/{id}/cancel` (admin; restocks via reversal).
**Adjustments:** `POST /inventory/adjustments {product_id, quantity_change (signed), reason: opening_balance|damaged|lost|found|correction|other, note?}`.

## Routes
| Method | Path | Summary |
|---|---|---|
| POST | /auth/login | Login |
| GET | /auth/me | Me |
| GET | /categories | List Categories |
| POST | /categories | Create Category |
| GET | /products | List Products |
| POST | /products | Create Product |
| GET | /products/{product_id} | Get Product |
| PATCH | /products/{product_id} | Update Product |
| DELETE | /products/{product_id} | Deactivate Product |
| GET | /products/{product_id}/suppliers | Product Suppliers |
| PUT | /products/{product_id}/suppliers | Upsert Product Supplier |
| DELETE | /products/{product_id}/suppliers/{supplier_id} | Unlink Product Supplier |
| GET | /suppliers | List Suppliers |
| POST | /suppliers | Create Supplier |
| GET | /suppliers/{supplier_id} | Get Supplier |
| PATCH | /suppliers/{supplier_id} | Update Supplier |
| GET | /suppliers/{supplier_id}/products | Supplier Products |
| POST | /purchases | Create Purchase |
| GET | /purchases | List Purchases |
| GET | /purchases/{purchase_id} | Get Purchase |
| POST | /purchases/{purchase_id}/receive | Receive Purchase |
| POST | /purchases/{purchase_id}/cancel | Cancel Purchase |
| POST | /sales | Create Sale |
| GET | /sales | List Sales |
| GET | /sales/{sale_id} | Get Sale |
| POST | /sales/{sale_id}/cancel | Cancel Sale |
| GET | /inventory | List Inventory |
| POST | /inventory/adjustments | Adjust Stock |
| GET | /inventory/movements | List Movements |
| GET | /intelligence/summary | Read-only demand / stockout / reorder / risk analysis for all active products (`?risk_category=`) |
| GET | /intelligence/reorder-recommendations | Products needing replenishment, most urgent first |
| GET | /intelligence/risk | Risk-scored inventory (`?risk_category=`, validated) |
| GET | /intelligence/products/{product_id} | Detailed analysis for one product (404 for other businesses) |
| GET | /intelligence/products/{product_id}/forecast | Actual daily sales + baseline projection (`history_days`, `forecast_days`) |
| GET | /intelligence/evaluation | Time-based holdout MAE/WAPE vs a naive baseline |
| GET | /health | Health |

### Intelligence endpoints (Phase 3)

All are authenticated, read-only, and return typed Pydantic responses. They never
create purchase orders. Full algorithm, formulas and limitations:
[`docs/INTELLIGENCE_ENGINE.md`](INTELLIGENCE_ENGINE.md).

Request:

```http
GET /intelligence/reorder-recommendations HTTP/1.1
Authorization: Bearer <token>
```

Response (abridged):

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
    "unit": "pcs",
    "current_stock": 5,
    "cost_price": "6.00",
    "demand_stats": {
      "total_units_sold": 60,
      "observed_sale_days": 30,
      "window_days": 30,
      "avg_daily_demand": 2.0,
      "weighted_daily_demand": 2.0,
      "insufficient_history": false
    },
    "forecast": {
      "daily_demand": 2.0,
      "forecast_7d_units": 14.0,
      "forecast_30d_units": 60.0,
      "method": "recency_weighted_moving_average",
      "is_machine_learning": false,
      "uses_category_fallback": false
    },
    "stockout_prediction": {
      "days_until_stockout": 2.5,
      "stockout_risk": "critical",
      "lead_time_days": 7,
      "lead_time_is_assumed": false
    },
    "reorder_recommendation": {
      "needs_reorder": true,
      "calculated_reorder_point": 24,
      "configured_reorder_point": 20,
      "effective_reorder_point": 24,
      "reorder_qty": 50,
      "supplier": {
        "supplier_id": 1,
        "supplier_name": "Test Supplier",
        "lead_time_days": 7,
        "min_order_qty": 50,
        "unit_cost": "5.50"
      },
      "explanation_details": {
        "units_sold": 60,
        "lead_time_source": "Test Supplier",
        "adjusted_for_moq": true,
        "disclaimer": "Estimate based on recent sales; not a guarantee."
      },
      "explanation": [
        "Calculated reorder point = ceil(2.00 units/day × 7 lead days + 10 safety) = 24 units.",
        "Advisory only — a user must review and confirm this order on the Purchases screen."
      ]
    },
    "risk": {
      "risk_score": 95,
      "risk_category": "critical",
      "recommended_action": "Raise a purchase order immediately."
    }
  }]
}
```

`GET /intelligence/evaluation` returns `metrics {mae_model, mae_naive, wape_model,
wape_naive, model_beats_naive_baseline}`, the train/test windows, per-product
errors and `data_limitations`. It is a rule-based baseline evaluation, not ML
accuracy.
