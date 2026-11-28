-- Install all StockIQ PostgreSQL database objects in dependency order.
-- Usage from this directory:
--   psql "$DATABASE_URL" -f install.sql
-- Or from psql: \i /absolute/path/to/db/postgresql/install.sql

\ir schema.sql
\ir views.sql
\ir routines.sql
\ir triggers.sql
