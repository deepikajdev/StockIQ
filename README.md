# StockIQ — Inventory & Reorder Recommendation Platform

React · FastAPI · MySQL 8 or PostgreSQL 14+. Built in phases:

| Phase | What | Status | Who |
|---|---|---|---|
| 2 | Backend: auth/RBAC, products, suppliers, purchases, sales, adjustments, ledger, transactional stock path | ✅ done + 11 tests (incl. 25-way concurrent oversell test) | Claude |
| 1 | DB layer: DDL, views, routine, triggers, seed, ER/normalization docs | 📝 `prompts/01_antigravity_database.md` | Antigravity |
| 3 | Intelligence (demand baseline, stockout, reorder, risk, evaluation), API + frontend wiring | ✅ implemented — rule-based, read-only; see [`docs/INTELLIGENCE_ENGINE.md`](docs/INTELLIGENCE_ENGINE.md) (17 backend + 6 new frontend tests) | Antigravity |
| 4 | Frontend | 📝 `prompts/02_stitch_frontend.md` (Stitch → Antigravity wiring) | Stitch + Antigravity |
| 5 | Deploy | Dockerfile, docker-compose, render.yaml ready | you |

## Run locally
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL and JWT_SECRET
python -m scripts.bootstrap     # creates tables, business, warehouse, admin + staff users
uvicorn app.main:app --reload   # http://localhost:8000/docs
pytest                          # needs the DB from .env; run against a scratch database
```
`DATABASE_URL` accepts `mysql+pymysql://…` (the development default) or
`postgresql+psycopg://…`. For a fresh PostgreSQL database, load the equivalent
DDL/views/function/triggers with `psql "$DATABASE_URL" -f db/postgresql/install.sql`;
`python -m scripts.bootstrap` also installs them idempotently. See
[`db/postgresql/README.md`](db/postgresql/README.md) and [`docs/database.md`](docs/database.md).

Demo logins (change via ADMIN_PASSWORD / STAFF_PASSWORD): `admin@stockiq.example.com / admin12345`, `staff@stockiq.example.com / staff12345`.

### PostgreSQL integration tests
The real PostgreSQL tests never connect unless the target is the dedicated local
database `stockiq_pg_test` with matching confirmation:

```bash
cd backend
DATABASE_URL='postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/stockiq_pg_test' \
STOCKIQ_TEST_DB=stockiq_pg_test \
python -m pytest tests/test_postgresql_integration.py -q
```

Without these variables the module reports `skipped`; the MySQL test suite is
unchanged (`STOCKIQ_TEST_DB=stockiq_test`). Never point tests at Supabase, staging
or production.

Or all-in-one: `JWT_SECRET=$(openssl rand -hex 32) docker compose up --build`.

## Design decisions (PRD open decisions)
Whole-unit integer quantities · one default warehouse · `business_id` on all business-owned tables and every query
scoped by it · lookback 30 days, review period 7 days · money = DECIMAL(12,2), sent as strings · UTC timestamps.

## Stock integrity
All stock changes go through `app/services/stock.py::change_stock` — row lock (`SELECT … FOR UPDATE`), non-negative check,
balance update, append-only ledger row, inside the caller's transaction. Sales lock rows in product-id order to avoid deadlocks.

## Deploy
See `docs/deploy.md`. Not production-ready for real businesses until the PRD §10 review (HTTPS, backups, secrets, tenant isolation) is done.
