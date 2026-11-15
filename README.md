# StockIQ — Inventory & Reorder Recommendation Platform

React · FastAPI · MySQL 8. Built in phases:

| Phase | What | Status | Who |
|---|---|---|---|
| 2 | Backend: auth/RBAC, products, suppliers, purchases, sales, adjustments, ledger, transactional stock path | ✅ done + 11 tests (incl. 25-way concurrent oversell test) | Claude |
| 1 | DB layer: DDL, views, routine, triggers, seed, ER/normalization docs | 📝 `prompts/01_antigravity_database.md` | Antigravity |
| 3 | Intelligence (stockout, reorder, alerts), reports, dashboard, more tests | 📝 `prompts/03_antigravity_intelligence.md` | Antigravity |
| 4 | Frontend | 📝 `prompts/02_stitch_frontend.md` (Stitch → Antigravity wiring) | Stitch + Antigravity |
| 5 | Deploy | Dockerfile, docker-compose, render.yaml ready | you |

## Run locally
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL (MySQL 8) and JWT_SECRET
python -m scripts.bootstrap     # creates tables, business, warehouse, admin + staff users
uvicorn app.main:app --reload   # http://localhost:8000/docs
pytest                          # needs the DB from .env; run against a scratch database
```
Demo logins (change via ADMIN_PASSWORD / STAFF_PASSWORD): `admin@stockiq.example.com / admin12345`, `staff@stockiq.example.com / staff12345`.

Or all-in-one: `JWT_SECRET=$(openssl rand -hex 32) docker compose up --build`.

## Design decisions (PRD open decisions)
Whole-unit integer quantities · one default warehouse · `business_id` on all business-owned tables and every query
scoped by it · lookback 30 days, review period 7 days · money = DECIMAL(12,2), sent as strings · UTC timestamps.

## Stock integrity
All stock changes go through `app/services/stock.py::change_stock` — row lock (`SELECT … FOR UPDATE`), non-negative check,
balance update, append-only ledger row, inside the caller's transaction. Sales lock rows in product-id order to avoid deadlocks.

## Deploy
See `docs/deploy.md`. Not production-ready for real businesses until the PRD §10 review (HTTPS, backups, secrets, tenant isolation) is done.
