# yoradio-station-list-builder

Browse a database of ~38,000 internet radio stations, build a playlist in the
browser, and export it as a tab-separated list for
[YoRadio](https://github.com/e2002/yoradio).

Runs on Cloudflare Workers: a single Worker serves the UI as static assets and
the JSON API from a [D1](https://developers.cloudflare.com/d1/) database.

## Layout

| Path | What it is |
|---|---|
| `src/` | The Worker — `index.ts` routes, `db.ts` queries, `params.ts` parsing |
| `public/` | Static UI served by the assets binding |
| `test/` | Vitest suite, run inside workerd against a real local D1 |
| `scripts/build-seed.sh` | Generates D1 import SQL from the SQLite database |
| `legacy/` | The original FastAPI app. **Unmaintained**, kept for reference |
| `legacy/db/stations.db` | Source of truth for the station data |

## First-time setup

```sh
npm install

# 1. Create the database
npx wrangler d1 create yoradio-stations
#    Copy the printed database_id into wrangler.jsonc

# 2. Generate the import SQL from legacy/db/stations.db
npm run seed:build

# 3. Load the data (~38k rows). Required — the app has no data without it.
npx wrangler d1 execute yoradio-stations --remote --file=d1/seed.sql
```

Step 3 is easy to forget and is not part of the deploy workflow. A freshly
deployed Worker with an unseeded database returns empty lists, not an error.

## Develop

```sh
npm run dev        # local Worker at http://localhost:8787
npm test           # vitest inside workerd
npm run typecheck
```

For local data, seed the local database once:

```sh
npx wrangler d1 execute yoradio-stations --local --file=d1/seed.sql
```

## Deploy

Manually, via the **Deploy to Cloudflare** GitHub Action (`workflow_dispatch`),
which typechecks and tests before deploying. It needs two repository secrets:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token with Workers Scripts + D1 edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account id |

Or locally: `npm run deploy`.

## API

All endpoints are read-only and CORS-open.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/stations` | `limit` (default 500, max 5000), `offset` |
| GET | `/api/stations/datatable` | `draw`, `start`, `length`, `search`, `country_id` |
| GET | `/api/stations/{country_id}` | |
| GET | `/api/countries` | Ordered by name |
| GET | `/api/countries/{id}` | |
| GET | `/api/count/countries` | `{"status":"ok","count":N}` |
| GET | `/api/count/stations` | `{"status":"ok","count":N}` |
| GET | `/api/search/station?name=` | Substring match on title |

### Differences from the legacy Python API

- **`/api/stations` is capped.** It previously returned all ~38,000 rows. D1
  bills rows read against a 5,000,000/day free-tier quota, so an uncapped
  endpoint let ~130 requests exhaust a day's budget. Pass `limit`/`offset`, or
  use `/api/stations/datatable` for paging.
- **`/metrics` is gone.** Prometheus scraping assumes one instance to scrape;
  a Worker runs at every edge location. Use Workers Analytics instead.

## Playlist format

Tab-separated, one station per line: `title\turl\tOvol\n`, exported as
`playlist.csv`. `Ovol` (output volume) is `0` for newly added stations. Import
parses the same format. The playlist lives entirely in the browser — nothing is
stored server-side.

## Cost notes

The two indexes created by `scripts/build-seed.sh` are load-bearing, not
tuning. D1 bills rows read, and without an index on `Stations(country_id)` a
country-filtered page view scans all 38,116 rows — roughly 131 page views would
exhaust the daily free-tier quota. With it, a page view reads about a page's
worth of rows.

## Legacy app

`legacy/` holds the original FastAPI application. It is kept for reference and
receives no updates; it will drift from the Worker. To run it:

```sh
cd legacy
pip install fastapi uvicorn loguru requests ujson starlette-exporter
python app.py          # http://0.0.0.0:8082
```
