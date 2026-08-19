import { describe, expect, it } from "vitest";
import { DEFAULT_STATION_LIMIT, MAX_STATION_LIMIT, parseCount, parseOffset } from "../src/params";

describe("parseCount", () => {
  it("returns the fallback when the param is absent", () => {
    expect(parseCount(null, DEFAULT_STATION_LIMIT, MAX_STATION_LIMIT)).toBe(DEFAULT_STATION_LIMIT);
  });

  it("returns the fallback for an empty string", () => {
    expect(parseCount("", 10, 100)).toBe(10);
  });

  it("returns the fallback for a non-numeric value", () => {
    expect(parseCount("abc", 10, 100)).toBe(10);
  });

  it("returns the fallback for a negative value", () => {
    expect(parseCount("-5", 10, 100)).toBe(10);
  });

  it("returns the fallback for a fractional value", () => {
    expect(parseCount("2.5", 10, 100)).toBe(10);
  });

  it("passes through a value within range", () => {
    expect(parseCount("42", 10, 100)).toBe(42);
  });

  it("clamps a value above the maximum", () => {
    expect(parseCount("999999", DEFAULT_STATION_LIMIT, MAX_STATION_LIMIT)).toBe(MAX_STATION_LIMIT);
  });

  it("allows zero", () => {
    expect(parseCount("0", 10, 100)).toBe(0);
  });
});

describe("parseOffset", () => {
  it("defaults to zero when absent", () => {
    expect(parseOffset(null)).toBe(0);
  });

  it("defaults to zero for a negative value", () => {
    expect(parseOffset("-3")).toBe(0);
  });

  it("passes through a valid offset", () => {
    expect(parseOffset("25")).toBe(25);
  });
});
