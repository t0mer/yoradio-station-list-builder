import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { seed } from "./fixture";

beforeAll(seed);

describe("GET /api/count/countries", () => {
  it("returns the total country count", async () => {
    const res = await SELF.fetch("https://example.com/api/count/countries");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", count: 3 });
  });
});

describe("GET /api/count/stations", () => {
  it("returns the total station count", async () => {
    const res = await SELF.fetch("https://example.com/api/count/stations");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", count: 6 });
  });
});

describe("GET /api/countries", () => {
  it("returns every country ordered by name", async () => {
    const res = await SELF.fetch("https://example.com/api/countries");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { name: "Argentina", id: 1 },
      { name: "Belgium", id: 2 },
      { name: "Chile", id: 3 },
    ]);
  });
});

describe("GET /api/countries/:id", () => {
  it("returns the matching country as a single-element array", async () => {
    const res = await SELF.fetch("https://example.com/api/countries/2");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ name: "Belgium", id: 2 }]);
  });

  it("returns an empty array for an unknown id", async () => {
    const res = await SELF.fetch("https://example.com/api/countries/999");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("rejects a non-numeric id", async () => {
    const res = await SELF.fetch("https://example.com/api/countries/abc");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/stations/datatable", () => {
  const dt = (qs: string) =>
    SELF.fetch(`https://example.com/api/stations/datatable?${qs}`).then((r: Response) => r.json() as any);

  it("echoes draw and reports unfiltered totals", async () => {
    const body = await dt("draw=7&start=0&length=10");

    expect(body.draw).toBe(7);
    expect(body.recordsTotal).toBe(6);
    expect(body.recordsFiltered).toBe(6);
    expect(body.data).toHaveLength(6);
  });

  it("narrows recordsFiltered by country while recordsTotal stays absolute", async () => {
    const body = await dt("draw=1&start=0&length=10&country_id=1");

    expect(body.recordsTotal).toBe(6);
    expect(body.recordsFiltered).toBe(3);
    expect(body.data.map((s: any) => s.id).sort()).toEqual(["a1", "a2", "a3"]);
  });

  it("narrows recordsFiltered by search term", async () => {
    const body = await dt("draw=1&start=0&length=10&search=alpha");

    expect(body.recordsFiltered).toBe(3);
    expect(body.data.map((s: any) => s.id).sort()).toEqual(["a1", "a3", "b2"]);
  });

  it("applies country and search together", async () => {
    const body = await dt("draw=1&start=0&length=10&country_id=1&search=alpha");

    expect(body.recordsFiltered).toBe(2);
    expect(body.data.map((s: any) => s.id).sort()).toEqual(["a1", "a3"]);
  });

  it("paginates with start and length", async () => {
    const page1 = await dt("draw=1&start=0&length=2&country_id=1");
    const page2 = await dt("draw=2&start=2&length=2&country_id=1");

    expect(page1.data).toHaveLength(2);
    expect(page2.data).toHaveLength(1);
    expect(page1.recordsFiltered).toBe(3);
  });

  it("joins the country name onto each row", async () => {
    const body = await dt("draw=1&start=0&length=1&country_id=2");

    expect(body.data[0]).toMatchObject({ country: "Belgium", country_id: 2 });
    expect(body.data[0]).toHaveProperty("final_url");
    expect(body.data[0]).toHaveProperty("title");
  });

  it("is matched before the /api/stations/:country_id route", async () => {
    const body = await dt("draw=1&start=0&length=10");

    // A country-id match would return a bare array, not a DataTables envelope.
    expect(body).toHaveProperty("draw");
    expect(Array.isArray(body)).toBe(false);
  });
});

describe("GET /api/stations/:country_id", () => {
  it("returns only that country's stations", async () => {
    const res = await SELF.fetch("https://example.com/api/stations/3");

    expect(res.status).toBe(200);
    const rows = (await res.json()) as any[];
    expect(rows.map((s) => s.id)).toEqual(["c1"]);
    expect(rows[0].country).toBe("Chile");
  });

  it("rejects a non-numeric country id", async () => {
    const res = await SELF.fetch("https://example.com/api/stations/not-a-number");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/stations", () => {
  it("returns stations capped at the default limit", async () => {
    const res = await SELF.fetch("https://example.com/api/stations");

    expect(res.status).toBe(200);
    expect((await res.json()) as any[]).toHaveLength(6);
  });

  it("honours an explicit limit", async () => {
    const res = await SELF.fetch("https://example.com/api/stations?limit=2");

    expect((await res.json()) as any[]).toHaveLength(2);
  });

  it("honours offset", async () => {
    const all = (await SELF.fetch("https://example.com/api/stations").then((r: Response) => r.json())) as any[];
    const skipped = (await SELF.fetch("https://example.com/api/stations?offset=4").then((r: Response) =>
      r.json(),
    )) as any[];

    expect(skipped).toHaveLength(2);
    expect(skipped[0].id).toBe(all[4].id);
  });

  it("clamps a limit above the maximum instead of erroring", async () => {
    const res = await SELF.fetch("https://example.com/api/stations?limit=999999");

    expect(res.status).toBe(200);
    expect((await res.json()) as any[]).toHaveLength(6);
  });
});

describe("GET /api/search/station", () => {
  it("matches on a substring of the title", async () => {
    const res = await SELF.fetch("https://example.com/api/search/station?name=jazz");

    expect(res.status).toBe(200);
    const rows = (await res.json()) as any[];
    expect(rows.map((s) => s.id)).toEqual(["a3"]);
  });

  it("requires the name parameter", async () => {
    const res = await SELF.fetch("https://example.com/api/search/station");

    expect(res.status).toBe(400);
  });
});

describe("request handling", () => {
  it("returns a JSON 404 for an unknown /api path, never HTML", async () => {
    const res = await SELF.fetch("https://example.com/api/nope");

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toMatchObject({ status: "error" });
  });

  it("rejects non-GET methods on the API", async () => {
    const res = await SELF.fetch("https://example.com/api/countries", { method: "POST" });

    expect(res.status).toBe(405);
  });

  it("answers CORS preflight", async () => {
    const res = await SELF.fetch("https://example.com/api/countries", { method: "OPTIONS" });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("sets CORS headers on API responses", async () => {
    const res = await SELF.fetch("https://example.com/api/countries");

    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("returns a JSON 500 when a query fails", async () => {
    // Stations first: D1 enforces the foreign key.
    await env.DB.prepare("DROP TABLE Stations").run();
    await env.DB.prepare("DROP TABLE Countries").run();
    try {
      const res = await SELF.fetch("https://example.com/api/countries");

      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({ status: "error" });
    } finally {
      await seed();
    }
  });
});
