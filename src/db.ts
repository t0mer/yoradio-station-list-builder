const STATION_COLUMNS = `
  Stations.id, Stations.title, Stations.final_url, Stations.country_id,
  Countries.name AS country`;

const STATION_FROM = `
  FROM Stations
  JOIN Countries ON Stations.country_id = Countries.id`;

export interface StationRow {
  id: string;
  title: string;
  final_url: string;
  country_id: number;
  country: string;
}

export async function countCountries(db: D1Database): Promise<number> {
  return (await db.prepare("SELECT COUNT(id) AS count FROM Countries").first<number>("count")) ?? 0;
}

export async function countStations(db: D1Database): Promise<number> {
  return (await db.prepare("SELECT COUNT(id) AS count FROM Stations").first<number>("count")) ?? 0;
}

export async function listCountries(db: D1Database): Promise<unknown[]> {
  const { results } = await db.prepare("SELECT name, id FROM Countries ORDER BY name").all();
  return results;
}

export async function countryById(db: D1Database, id: number): Promise<unknown[]> {
  const { results } = await db.prepare("SELECT name, id FROM Countries WHERE id = ?").bind(id).all();
  return results;
}

export async function listStations(
  db: D1Database,
  limit: number,
  offset: number,
): Promise<StationRow[]> {
  const { results } = await db
    .prepare(`SELECT ${STATION_COLUMNS} ${STATION_FROM} LIMIT ? OFFSET ?`)
    .bind(limit, offset)
    .all<StationRow>();
  return results;
}

export async function stationsByCountry(db: D1Database, countryId: number): Promise<StationRow[]> {
  const { results } = await db
    .prepare(`SELECT ${STATION_COLUMNS} ${STATION_FROM} WHERE Stations.country_id = ?`)
    .bind(countryId)
    .all<StationRow>();
  return results;
}

export async function searchStations(db: D1Database, name: string): Promise<StationRow[]> {
  const { results } = await db
    .prepare(`SELECT ${STATION_COLUMNS} ${STATION_FROM} WHERE Stations.title LIKE ?`)
    .bind(`%${name}%`)
    .all<StationRow>();
  return results;
}

export interface DataTablePage {
  data: StationRow[];
  recordsTotal: number;
  recordsFiltered: number;
}

/** Server-side pagination backing the DataTables grid. */
export async function stationsPage(
  db: D1Database,
  countryId: number,
  search: string,
  start: number,
  length: number,
): Promise<DataTablePage> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (countryId > 0) {
    where.push("Stations.country_id = ?");
    params.push(countryId);
  }
  if (search) {
    where.push("Stations.title LIKE ?");
    params.push(`%${search}%`);
  }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const [filtered, total, page] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS count ${STATION_FROM}${clause}`).bind(...params),
    db.prepare("SELECT COUNT(*) AS count FROM Stations"),
    db
      .prepare(`SELECT ${STATION_COLUMNS} ${STATION_FROM}${clause} LIMIT ? OFFSET ?`)
      .bind(...params, length, start),
  ]);

  return {
    data: page.results as StationRow[],
    recordsTotal: (total.results[0] as { count: number }).count,
    recordsFiltered: (filtered.results[0] as { count: number }).count,
  };
}
