# Deploy (free-tier friendly)

1. **Database:** create a hosted MySQL 8 (Aiven, Railway, or TiDB Serverless). Copy the URL as
   `mysql+pymysql://USER:PASS@HOST:PORT/DBNAME` (add `?ssl_ca=...` if the provider requires TLS).
2. **Backend (Render / Railway / Fly):** point at `backend/` (Dockerfile). Env: `DATABASE_URL`, `JWT_SECRET`
   (long random), `CORS_ORIGINS` (your frontend URL), `ADMIN_PASSWORD`, `STAFF_PASSWORD` (do NOT keep defaults).
   The container runs `scripts.bootstrap` on start (idempotent) then uvicorn. Health check: `/health`.
3. **Frontend (Vercel / Netlify / Cloudflare Pages):** build `frontend/` with `VITE_API_URL=https://<api-host>`.
4. Add the frontend origin to `CORS_ORIGINS`, redeploy backend, log in, run `python db/seed.py` once for demo data.
5. Backups: `mysqldump --single-transaction` (see `db/backup.md` once Phase 1 lands).
