#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-http://localhost:8080}
DB_PATH=${DB_PATH:-meta_dj.local.sqlite}

echo "[1/6] Ensure stack is up (db + api)"
docker compose up -d db
# wait for db
echo -n "Waiting for Postgres"
for i in {1..30}; do
  if docker compose exec -T db pg_isready -U meta -d meta_dj >/dev/null 2>&1; then echo " OK"; break; fi
  echo -n "."
  sleep 1
done
docker compose up -d api

echo "[2/6] Create a change locally (add a cue)"
track_id=$(sqlite3 "$DB_PATH" "SELECT id FROM tracks LIMIT 1;") || true
if [ -z "${track_id:-}" ]; then
  echo "No tracks found in $DB_PATH. Import some files first."
  exit 1
fi
node packages/core/src/cli.js cue add "$track_id" 12345 'PersistTest' red HOT

echo "[3/6] Push change to API"
node packages/core/src/cli.js sync push "$API_BASE"

echo "[4/6] Restart API container"
docker compose restart api
sleep 2

echo "[5/6] Pull from API after restart"
out=$(node packages/core/src/cli.js sync pull "$API_BASE")
echo "$out" | jq 'length' 2>&1 || (echo "$out" && exit 1)
count=$(echo "$out" | jq 'length')
echo "Changes after restart: $count"
if [ "$count" -lt 1 ]; then
  echo "FAIL: No changes returned after restart"
  exit 1
fi

echo "[6/6] Success: persistence verified"