# StockIQ API contract (v1)

Base URL: `VITE_API_URL` (dev: http://localhost:8000). Interactive docs: `/docs`. Full schema: `docs/openapi.json`.

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
| GET | /health | Health |

> Phase 3 (Antigravity) appends: /alerts/low-stock, /analytics/stockout, /recommendations/reorder, /reports/*, /dashboard/summary.
