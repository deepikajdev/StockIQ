# StockIQ Database Backup & Restore Guide

This guide documents operational procedures for backing up and restoring the StockIQ MySQL 8 / MariaDB 10.11 database using `mysqldump` and native database client tools.

---

## 1. Full Production Backup

To perform a consistent, non-blocking logical backup of the entire database—including tables, views, stored procedures (`sp_reconcile_inventory`), and triggers (`trg_stock_movements_no_*`):

```bash
mysqldump \
  --host=localhost \
  --port=3306 \
  --user=stockiq \
  --password \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --default-character-set=utf8mb4 \
  --set-gtid-purged=OFF \
  stockiq > stockiq_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Why these flags are critical:
- `--single-transaction`: Uses InnoDB's Multi-Version Concurrency Control (MVCC) to obtain a point-in-time consistent snapshot without placing table-level read locks. Ongoing sales transactions, stock adjustments, and API requests continue without interruption.
- `--quick`: Streams rows one-by-one from the server instead of buffering complete table result sets into client memory, preventing Out-Of-Memory (OOM) failures on large tables like `stock_movements`.
- `--routines`: Dumps stored procedures, notably `sp_reconcile_inventory()`.
- `--triggers`: Preserves the append-only triggers on `stock_movements`.
- `--default-character-set=utf8mb4`: Ensures full 4-byte UTF-8 encoding support for special characters and multilingual product descriptions.
- `--set-gtid-purged=OFF`: Prevents GTID errors when restoring into environments where GTID execution history is not synchronized.

---

## 2. Compressed Production Backup

For efficient storage and bandwidth reduction:

```bash
mysqldump \
  --host=localhost \
  --port=3306 \
  --user=stockiq \
  --password \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  stockiq | gzip -9 > stockiq_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

---

## 3. Specialized Dumps

### Schema-Only Dump (DDL without records)
Exports structure, views, routines, and triggers:
```bash
mysqldump \
  -u stockiq -p \
  --no-data \
  --routines \
  --triggers \
  stockiq > stockiq_schema_only.sql
```

### Data-Only Dump (Records without table creation DDL)
Useful for refreshing staging or dev environments where schema is pre-deployed:
```bash
mysqldump \
  -u stockiq -p \
  --no-create-info \
  --single-transaction \
  --quick \
  stockiq > stockiq_data_only.sql
```

---

## 4. Database Restoration

### Step 1: Create an Empty Target Database
Ensure proper character set and collation are configured:
```sql
CREATE DATABASE IF NOT EXISTS stockiq
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
```
*(For MariaDB 10.11, use `utf8mb4_unicode_ci` or `utf8mb4_general_ci` if `utf8mb4_0900_ai_ci` is unsupported).*

### Step 2: Restore from SQL File
```bash
mysql \
  --host=localhost \
  --port=3306 \
  --user=stockiq \
  --password \
  stockiq < stockiq_backup.sql
```

### Restoring from a Gzipped Backup:
```bash
gunzip < stockiq_backup.sql.gz | mysql -u stockiq -p stockiq
```

### Step 3: Verify Ledger Reconciliation Post-Restore
Run the reconciliation routine to confirm that inventory balances match the append-only ledger:
```bash
mysql -u stockiq -p stockiq -e "CALL sp_reconcile_inventory();"
```
Zero rows returned confirms 100% data integrity.

---

## 5. Automated Daily Backup (Cron Example)

Create `/etc/cron.daily/stockiq_backup.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/stockiq"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/stockiq_${TIMESTAMP}.sql.gz"

# Export password securely via environment
export MYSQL_PWD="${DB_PASSWORD}"

mysqldump \
  -h localhost \
  -u stockiq \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  stockiq | gzip -9 > "${BACKUP_FILE}"

# Retention: Delete backups older than 30 days
find "${BACKUP_DIR}" -name "stockiq_*.sql.gz" -mtime +30 -delete

echo "StockIQ backup completed: ${BACKUP_FILE}"
```
Ensure permissions are restricted:
```bash
chmod 700 /etc/cron.daily/stockiq_backup.sh
```
