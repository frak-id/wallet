#!/usr/bin/env bash
set -euo pipefail

# Full PostgreSQL database dump using pg_dump
# Reads connection info from the same env vars as the migration service
# Output: services/migration/dumps/dump-{stage}-{timestamp}.sql.gz

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DUMPS_DIR="${SCRIPT_DIR}/../dumps"

ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

STAGE="${STAGE:-dev}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB is required}"
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER is required}"
POSTGRES_SCHEMA="${POSTGRES_SCHEMA:-public}"

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    echo "[db-dump] ERROR: POSTGRES_PASSWORD is required"
    exit 1
fi

export PGPASSWORD="$POSTGRES_PASSWORD"

mkdir -p "$DUMPS_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${DUMPS_DIR}/dump-${STAGE}-${TIMESTAMP}.sql.gz"
LATEST_LINK="${DUMPS_DIR}/dump-${STAGE}-latest.sql.gz"

echo "[db-dump] Stage: ${STAGE}"
echo "[db-dump] Host: ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "[db-dump] Database: ${POSTGRES_DB}"
echo "[db-dump] User: ${POSTGRES_USER}"
echo "[db-dump] Schema: ${POSTGRES_SCHEMA}"
echo "[db-dump] Output: ${DUMP_FILE}"
echo ""

pg_dump \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --schema="$POSTGRES_SCHEMA" \
    --no-owner \
    --no-privileges \
    --verbose \
    2>&1 | gzip > "$DUMP_FILE"

ln -sf "$(basename "$DUMP_FILE")" "$LATEST_LINK"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo ""
echo "============================================================"
echo "DB DUMP COMPLETE"
echo "============================================================"
echo "File: ${DUMP_FILE}"
echo "Size: ${DUMP_SIZE}"
echo "Latest: ${LATEST_LINK}"
echo "============================================================"
echo ""
echo "To restore: bun run db:restore ${DUMP_FILE}"
