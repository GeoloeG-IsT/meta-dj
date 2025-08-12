#!/usr/bin/env bash
set -euo pipefail

DB_PATH=${1:-meta_dj.local.sqlite}

echo "Applying migrations to ${DB_PATH}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 not found. Please install SQLite3." >&2
  exit 1
fi

MIGRATIONS_DIR="packages/core/migrations"

# Ensure migrations registry exists
sqlite3 "${DB_PATH}" "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));" >/dev/null 2>&1 || true

for migration in $(ls -1 ${MIGRATIONS_DIR}/*.sql | sort); do
  base=$(basename "${migration}")
  version="${base%.sql}"
  applied=$(sqlite3 "${DB_PATH}" "SELECT 1 FROM schema_migrations WHERE version='${version}' LIMIT 1;" || true)
  if [ "${applied}" = "1" ]; then
    echo "Skipping ${base} (already applied)"
    continue
  fi
  echo "Running ${base}"
  sqlite3 "${DB_PATH}" < "${migration}"
done

echo "Done. Current schema versions:"
sqlite3 "${DB_PATH}" "SELECT version, applied_at FROM schema_migrations ORDER BY applied_at;" | cat


