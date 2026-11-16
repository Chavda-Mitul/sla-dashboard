import { describe, expect, it } from "vitest";
import { parseLatency, parseStatus, parseTimestamp } from "./normalize.js";

function utc(input: string): string {
  const result = parseTimestamp(input);
  if (!result.ok) throw new Error(`expected ${input} to parse, got ${result.reason}`);
  return result.date.toISOString();
}

describe("parseTimestamp", () => {
  it("accepts ISO-8601 UTC", () => {
    expect(parseTimestamp("2025-05-08T10:15:00Z")).toEqual({ ok: true, date: new Date("2025-05-08T10:15:00Z") });
  });

  it("converts a +05:30 offset to UTC (real row from the 9-day file)", () => {
    expect(utc("2025-05-13T02:00:00+05:30")).toBe("2025-05-12T20:30:00.000Z");
    expect(parseTimestamp("2025-05-13T02:00:00+05:30")).toMatchObject({ flag: "ts_from_offset" });
  });

  it("handles negative offsets", () => {
    expect(utc("2025-05-08T05:15:00-05:00")).toBe("2025-05-08T10:15:00.000Z");
  });

  it("converts epoch seconds (real row from the 14-day file)", () => {
    expect(utc("1748729700")).toBe("2025-05-31T22:15:00.000Z");
    expect(parseTimestamp("1748729700")).toMatchObject({ flag: "ts_from_epoch" });
  });

  it("treats the three formats of the same instant as equal", () => {
    expect(new Set([utc("2025-05-08T10:15:00Z"), utc("2025-05-08T15:45:00+05:30"), utc("1746699300")]).size).toBe(1);
  });

  it.each([
    ["no timezone (ambiguous)", "2025-05-08T10:15:00"],
    ["date only", "2025-05-08"],
    ["not a date", "yesterday"],
    ["empty", ""],
    ["Feb 30 (Date would roll it to Mar 2)", "2025-02-30T00:00:00Z"],
    ["hour 24", "2025-05-08T24:00:00Z"],
    ["epoch milliseconds", "1748729700000"],
  ])("rejects %s", (_label, input) => {
    expect(parseTimestamp(input)).toEqual({ ok: false, reason: "invalid_timestamp" });
  });

  it("rejects times that are not on the 15-minute grid", () => {
    expect(parseTimestamp("2025-05-08T10:07:00Z")).toEqual({ ok: false, reason: "off_grid_timestamp" });
    expect(parseTimestamp("2025-05-08T10:15:30Z")).toEqual({ ok: false, reason: "off_grid_timestamp" });
  });
});

describe("parseStatus", () => {
  it.each([
    ["200", 200],
    ["503", 503],
    ["404", 404],
  ])("accepts %s", (input, expected) => {
    expect(parseStatus(input)).toBe(expected);
  });

  it.each(["999", "0", "", "abc", "20", "2000", "200.0"])("rejects %j", (input) => {
    expect(parseStatus(input)).toBeNull();
  });
});

describe("parseLatency", () => {
  it("keeps milliseconds", () => {
    expect(parseLatency("258", "ms")).toEqual({ ms: 258 });
  });

  it("converts seconds to integer ms (svc-search)", () => {
    expect(parseLatency("0.486", "s")).toEqual({ ms: 486, flag: "latency_from_seconds" });
    // 0.51 * 1000 is 510.00000000000006 in floating point
    expect(parseLatency("0.51", "s")).toEqual({ ms: 510, flag: "latency_from_seconds" });
  });

  it("is case-insensitive about the unit", () => {
    expect(parseLatency("12", "MS")).toEqual({ ms: 12 });
  });

  it.each([
    ["", "ms", "latency_missing"],
    ["-286", "ms", "latency_negative"],
    ["fast", "ms", "latency_invalid"],
    ["1e3", "ms", "latency_invalid"],
    ["12", "us", "latency_unknown_unit"],
  ])("nulls %j %s as %s", (value, unit, flag) => {
    expect(parseLatency(value, unit)).toEqual({ ms: null, flag });
  });
});
