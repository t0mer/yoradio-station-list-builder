import { env } from "cloudflare:test";

/**
 * Mirrors d1/schema.sql. Kept as discrete statements because D1's `exec`
 * is newline-sensitive; each is issued via a prepared statement instead.
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS Countries (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL UNIQUE
   )`,
  `CREATE TABLE IF NOT EXISTS Stations (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     final_url TEXT NOT NULL,
     country_id INTEGER,
     FOREIGN KEY (country_id) REFERENCES Countries(id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_stations_country_id ON Stations(country_id)`,
  `CREATE INDEX IF NOT EXISTS idx_stations_title ON Stations(title)`,
];

export const COUNTRIES = [
  { id: 1, name: "Argentina" },
  { id: 2, name: "Belgium" },
  { id: 3, name: "Chile" },
];

export const STATIONS = [
  { id: "a1", title: "Radio Alpha", final_url: "http://alpha.example/1", country_id: 1 },
  { id: "a2", title: "Radio Beta", final_url: "http://beta.example/2", country_id: 1 },
  { id: "a3", title: "Alpha Jazz", final_url: "http://jazz.example/3", country_id: 1 },
  { id: "b1", title: "Brussels Beat", final_url: "http://bxl.example/4", country_id: 2 },
  { id: "b2", title: "Radio Alpha Nord", final_url: "http://nord.example/5", country_id: 2 },
  { id: "c1", title: "Santiago Sound", final_url: "http://stgo.example/6", country_id: 3 },
];

/** Rebuild the database from scratch so each test file starts identical. */
export async function seed(): Promise<void> {
  await env.DB.prepare("DROP TABLE IF EXISTS Stations").run();
  await env.DB.prepare("DROP TABLE IF EXISTS Countries").run();
  for (const stmt of SCHEMA) await env.DB.prepare(stmt).run();

  await env.DB.batch([
    ...COUNTRIES.map((c) =>
      env.DB.prepare("INSERT INTO Countries (id, name) VALUES (?, ?)").bind(c.id, c.name),
    ),
    ...STATIONS.map((s) =>
      env.DB
        .prepare("INSERT INTO Stations (id, title, final_url, country_id) VALUES (?, ?, ?, ?)")
        .bind(s.id, s.title, s.final_url, s.country_id),
    ),
  ]);
}
