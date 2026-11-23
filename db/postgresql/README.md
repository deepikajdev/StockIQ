# StockIQ PostgreSQL database artifacts

These files are the PostgreSQL equivalents of the MySQL artifacts in `db/`.
The MySQL files remain unchanged so existing MySQL/MariaDB deployments keep working.

## Files

| File | MySQL original | Purpose |
| --- | --- | --- |
| `schema.sql` | `db/schema.sql` | 15 tables with identity columns, `BOOLEAN`, `TIMESTAMP WITHOUT TIME ZONE`, `JSONB`, all primary/unique/foreign keys, checks and indexes. |
| `views.sql` | `db/views.sql` | The same 4 views with PostgreSQL boolean predicates and interval syntax. |
| `routines.sql` | `db/routines.sql` | Set-returning `sp_reconcile_inventory()` function. Call with `SELECT * FROM sp_reconcile_inventory();`. |
| `triggers.sql` | `db/triggers.sql` | Append-only ledger triggers plus `ON UPDATE CURRENT_TIMESTAMP` equivalents. |
| `transaction_demo.sql` | `db/transaction_demo.sql` | Atomic rollback demonstration using PostgreSQL syntax. |
| `queries/01`–`queries/05` | `db/queries/` | The 5 report scripts converted to PostgreSQL syntax. |
| `install.sql` | — | psql meta-script that loads schema, views, routine and triggers in order. |

## Installation

Create an empty database first (name, owner and password are supplied by the
operator; no credentials are stored in this repository):

```bash
createdb stockiq
psql "$DATABASE_URL" -f db/postgresql/install.sql
```

Set the application `DATABASE_URL` to a `postgresql+psycopg://...` URL. Production
must additionally use `sslmode=verify-ca` or `verify-full` and an explicit
`sslrootcert`; see `backend/.env.example`.

## Append-only ledger bypass

Normal application code must never update or delete `stock_movements`. Seed and
test fixture maintenance can temporarily allow it in one session:

```sql
SELECT set_config('stockiq.allow_ledger_mutation', '1', false);
-- maintenance
SELECT set_config('stockiq.allow_ledger_mutation', '0', false);
```

`db/seed.py` performs this automatically for PostgreSQL via SQLAlchemy.

## Verification

After seeding:

```sql
SELECT * FROM sp_reconcile_inventory();
```

Zero rows means inventory balances and the movement ledger agree.

## Tests

PostgreSQL integration tests are gated on a dedicated local database:

```bash
cd backend
DATABASE_URL='postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/stockiq_pg_test' \
STOCKIQ_TEST_DB=stockiq_pg_test \
python -m pytest tests/test_postgresql_integration.py -q
```

The guard rejects any PostgreSQL database other than `stockiq_pg_test`, any
non-local host without an explicit override, and any missing/incorrect
`STOCKIQ_TEST_DB` confirmation. Never point these tests at Supabase or a
production database.
