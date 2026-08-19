#!/usr/bin/env python3
"""Generate D1 migrations from the legacy SQLite database.

Output goes to migrations/ and is COMMITTED, because Cloudflare's build image
has no sqlite3 CLI and clones only what is in git. `wrangler d1 migrations
apply` records applied migrations in the d1_migrations table, so these run
exactly once no matter how many times the Worker is deployed.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "legacy" / "db" / "stations.db"
OUT = ROOT / "migrations"

# D1 rejects any single statement of 100,000 bytes or more. Rows average well
# under 200 bytes, so 200 rows per INSERT lands around 25 KB with wide margin.
ROWS_PER_INSERT = 200
MAX_STATEMENT_BYTES = 100_000

SCHEMA = """\
-- Schema for the YoRadio station database.
CREATE TABLE IF NOT EXISTS Countries (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Stations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    final_url TEXT NOT NULL,
    country_id INTEGER,
    FOREIGN KEY (country_id) REFERENCES Countries(id)
);

-- Required, not an optimization. D1 bills rows read; without these a
-- country-filtered page view scans all ~38k rows instead of one page.
CREATE INDEX IF NOT EXISTS idx_stations_country_id ON Stations(country_id);
CREATE INDEX IF NOT EXISTS idx_stations_title ON Stations(title);
"""


def lit(value: object) -> str:
    """Render a Python value as a SQLite literal."""
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def insert_batches(table: str, columns: list[str], rows: list[tuple]) -> list[str]:
    """Build multi-row INSERTs.

    OR IGNORE so a partially applied migration can be retried by hand without
    tripping over primary keys that already landed.
    """
    head = f"INSERT OR IGNORE INTO {table} ({', '.join(columns)}) VALUES\n"
    out: list[str] = []
    for i in range(0, len(rows), ROWS_PER_INSERT):
        chunk = rows[i : i + ROWS_PER_INSERT]
        values = ",\n".join("  (" + ", ".join(lit(c) for c in row) + ")" for row in chunk)
        stmt = head + values + ";"
        if len(stmt.encode("utf-8")) >= MAX_STATEMENT_BYTES:
            raise SystemExit(
                f"statement of {len(stmt.encode('utf-8'))} bytes exceeds D1's "
                f"{MAX_STATEMENT_BYTES}-byte limit; lower ROWS_PER_INSERT"
            )
        out.append(stmt)
    return out


def main() -> None:
    if not DB.exists():
        raise SystemExit(f"error: {DB} not found")

    OUT.mkdir(exist_ok=True)
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)

    schema_path = OUT / "0001_create_schema.sql"
    schema_path.write_text(SCHEMA)
    print(f"==> {schema_path.relative_to(ROOT)}")

    countries = conn.execute("SELECT id, name FROM Countries ORDER BY id").fetchall()
    stations = conn.execute(
        "SELECT id, title, final_url, country_id FROM Stations ORDER BY id"
    ).fetchall()
    conn.close()

    body = [
        "-- Station data, generated from legacy/db/stations.db by",
        "-- scripts/build-migrations.py. Do not edit by hand.",
        "-- Countries insert before Stations: D1 enforces the foreign key.",
        "",
        *insert_batches("Countries", ["id", "name"], countries),
        "",
        *insert_batches(
            "Stations", ["id", "title", "final_url", "country_id"], stations
        ),
        "",
    ]
    seed_path = OUT / "0002_seed_stations.sql"
    seed_path.write_text("\n".join(body))

    size = seed_path.stat().st_size
    longest = max(len(s.encode("utf-8")) for s in seed_path.read_text().split(";\n"))
    print(f"==> {seed_path.relative_to(ROOT)}")
    print(
        f"    {len(countries)} countries, {len(stations)} stations, "
        f"{size // 1024} KiB, longest statement {longest} bytes"
    )


if __name__ == "__main__":
    main()
