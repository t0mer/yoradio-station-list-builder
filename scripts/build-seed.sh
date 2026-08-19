#!/usr/bin/env bash
# Generate D1 import SQL from the legacy SQLite database.
#
# There is no `wrangler d1 import` command; the documented path is to convert
# the SQLite file to SQL and feed it to `wrangler d1 execute --file`.
# See: https://developers.cloudflare.com/d1/best-practices/import-export-data/
#
# Outputs (both gitignored — legacy/db/stations.db is the tracked source):
#   d1/schema.sql  DDL + indexes only
#   d1/seed.sql    DDL + indexes + every row
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${ROOT}/legacy/db/stations.db"
OUT="${ROOT}/d1"

[ -f "$DB" ] || { echo "error: $DB not found" >&2; exit 1; }
command -v sqlite3 >/dev/null || { echo "error: sqlite3 not installed" >&2; exit 1; }

mkdir -p "$OUT"

INDEXES=$(cat <<'SQL'

-- Required, not an optimization: D1 bills rows read, and an unindexed scan
-- bills every row of the 38k-row table on each country-filtered page view.
CREATE INDEX IF NOT EXISTS idx_stations_country_id ON Stations(country_id);
CREATE INDEX IF NOT EXISTS idx_stations_title ON Stations(title);
SQL
)

# `_cf_KV` is reserved by D1 and must never appear in an import.
# BEGIN TRANSACTION / COMMIT are rejected by `wrangler d1 execute`.
# PRAGMA is dropped because D1 supports only a narrow subset and a rejected
# statement fails the whole import. Safe here: the dump emits all 228 Countries
# before the first Station, and the source has zero orphan country_id values,
# so foreign keys are satisfied without deferring them.
strip() {
  grep -v -e '^BEGIN TRANSACTION;$' -e '^COMMIT;$' -e '_cf_KV' -e '^PRAGMA '
}

echo "==> generating ${OUT}/schema.sql"
sqlite3 "$DB" .schema | strip > "${OUT}/schema.sql"
printf '%s\n' "$INDEXES" >> "${OUT}/schema.sql"

echo "==> generating ${OUT}/seed.sql"
sqlite3 "$DB" .dump | strip > "${OUT}/seed.sql"
printf '%s\n' "$INDEXES" >> "${OUT}/seed.sql"

# Guard the documented D1 limits before anyone tries to import.
SIZE=$(wc -c < "${OUT}/seed.sql")
LONGEST=$(awk '{ if (length($0) > m) m = length($0) } END { print m+0 }' "${OUT}/seed.sql")
echo "    seed.sql: $((SIZE / 1024)) KiB, longest statement ${LONGEST} bytes"

if [ "$LONGEST" -ge 100000 ]; then
  echo "error: a statement exceeds D1's 100,000-byte limit" >&2
  exit 1
fi

echo
echo "Import with:"
echo "  npx wrangler d1 execute yoradio-stations --remote --file=d1/seed.sql"
