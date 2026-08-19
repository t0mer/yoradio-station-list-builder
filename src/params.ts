/** Default page size for GET /api/stations when no limit is supplied. */
export const DEFAULT_STATION_LIMIT = 500;

/**
 * Hard ceiling for GET /api/stations. D1 bills rows read against a 5M/day
 * free-tier quota, so an uncapped endpoint returning all 38k rows is a
 * denial-of-wallet risk. Values above this clamp rather than error.
 */
export const MAX_STATION_LIMIT = 5000;

/** Parse a positive integer query param, falling back when absent or invalid. */
export function parseCount(raw: string | null, fallback: number, max: number): number {
  if (raw === null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return fallback;
  return Math.min(n, max);
}

/** Parse a non-negative offset, defaulting to 0. */
export function parseOffset(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}
