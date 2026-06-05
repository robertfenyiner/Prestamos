#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/Prestamos}"
DB_PATH="${DB_PATH:-$APP_DIR/backend/data/prestamos.db}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/prestamos}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MIN_TABLES="${MIN_TABLES:-5}"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: SQLite database not found at $DB_PATH" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 command is required for verified backups" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/prestamos-$TIMESTAMP.db"
COMPRESSED_FILE="$BACKUP_FILE.gz"

SOURCE_INTEGRITY="$(sqlite3 "$DB_PATH" 'PRAGMA integrity_check;' | head -n 1)"
if [ "$SOURCE_INTEGRITY" != "ok" ]; then
  echo "ERROR: source database integrity check failed: $SOURCE_INTEGRITY" >&2
  exit 1
fi

# Use SQLite's online backup API. This is safe with WAL mode and active readers.
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

BACKUP_INTEGRITY="$(sqlite3 "$BACKUP_FILE" 'PRAGMA integrity_check;' | head -n 1)"
if [ "$BACKUP_INTEGRITY" != "ok" ]; then
  rm -f "$BACKUP_FILE"
  echo "ERROR: backup integrity check failed: $BACKUP_INTEGRITY" >&2
  exit 1
fi

TABLE_COUNT="$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")"
USER_COUNT="$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo 0)"

if [ "$TABLE_COUNT" -lt "$MIN_TABLES" ]; then
  rm -f "$BACKUP_FILE"
  echo "ERROR: backup has too few tables: $TABLE_COUNT" >&2
  exit 1
fi

if [ "$USER_COUNT" -lt 1 ]; then
  rm -f "$BACKUP_FILE"
  echo "ERROR: backup has no users" >&2
  exit 1
fi

gzip -f "$BACKUP_FILE"
chmod 600 "$COMPRESSED_FILE"

# Remove old compressed backups.
find "$BACKUP_DIR" -type f -name 'prestamos-*.db.gz' -mtime +"$RETENTION_DAYS" -delete

cat <<EOF
Backup created: $COMPRESSED_FILE
Source integrity: $SOURCE_INTEGRITY
Backup integrity: $BACKUP_INTEGRITY
Tables: $TABLE_COUNT
Users: $USER_COUNT
Retention days: $RETENTION_DAYS
EOF
