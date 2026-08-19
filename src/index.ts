import * as db from "./db";
import { DEFAULT_STATION_LIMIT, MAX_STATION_LIMIT, parseCount, parseOffset } from "./params";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json;charset=UTF-8", ...CORS },
  });

const badRequest = (message: string): Response => json({ status: "error", message }, 400);

/** Parse a path segment that must be an integer id. */
const asId = (raw: string): number | null => {
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
};

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const q = url.searchParams;

  if (path === "/api/count/countries") {
    return json({ status: "ok", count: await db.countCountries(env.DB) });
  }

  if (path === "/api/count/stations") {
    return json({ status: "ok", count: await db.countStations(env.DB) });
  }

  if (path === "/api/countries") {
    return json(await db.listCountries(env.DB));
  }

  const countryMatch = path.match(/^\/api\/countries\/([^/]+)$/);
  if (countryMatch) {
    const id = asId(countryMatch[1]);
    if (id === null) return badRequest("country id must be an integer");
    return json(await db.countryById(env.DB, id));
  }

  // Must precede /api/stations/:country_id, or "datatable" parses as an id.
  if (path === "/api/stations/datatable") {
    const page = await db.stationsPage(
      env.DB,
      parseCount(q.get("country_id"), 0, Number.MAX_SAFE_INTEGER),
      q.get("search") ?? "",
      parseOffset(q.get("start")),
      parseCount(q.get("length"), 10, MAX_STATION_LIMIT),
    );
    return json({ draw: parseCount(q.get("draw"), 1, Number.MAX_SAFE_INTEGER), ...page });
  }

  if (path === "/api/stations") {
    const limit = parseCount(q.get("limit"), DEFAULT_STATION_LIMIT, MAX_STATION_LIMIT);
    return json(await db.listStations(env.DB, limit, parseOffset(q.get("offset"))));
  }

  const stationsMatch = path.match(/^\/api\/stations\/([^/]+)$/);
  if (stationsMatch) {
    const id = asId(stationsMatch[1]);
    if (id === null) return badRequest("country id must be an integer");
    return json(await db.stationsByCountry(env.DB, id));
  }

  if (path === "/api/search/station") {
    const name = q.get("name");
    if (name === null) return badRequest("the 'name' query parameter is required");
    return json(await db.searchStations(env.DB, name));
  }

  return json({ status: "error", message: "no such endpoint" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Static assets are served by the assets binding; only /api/* is ours.
    // run_worker_first in wrangler.jsonc routes /api/* here regardless of
    // whether a same-named asset exists.
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ status: "error", message: "method not allowed" }, 405);
    }

    try {
      return await handleApi(request, env, url);
    } catch (err) {
      console.error("api error", err);
      return json({ status: "error", message: "internal error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
