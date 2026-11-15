import { describe, expect, it } from "vitest";
import { readDataFile } from "../../test/fixtures.js";
import { cleanChecks } from "../clean/cleanChecks.js";
import { SLOT_MS } from "../time.js";
import { computeStats, percentile, type CheckSample } from "./stats.js";

const T0 = Date.parse("2025-05-08T00:00:00Z");

/** One character per 15-minute check: "X" = 503, "." = 200. */
function checks(serviceId: string, pattern: string, start = T0): CheckSample[] {
  return [...pattern].map((char, i) => ({
    serviceId,
    serviceName: `${serviceId}-api`,
    checkedAt: new Date(start + i * SLOT_MS),
    statusCode: char === "X" ? 503 : 200,
    latencyMs: 100 + i,
  }));
}

describe("computeStats", () => {
  it("counts only outage time as downtime, and transient failures separately", () => {
    // Failure at 0 is transient; failures at 4-6 are a 45-minute outage. 8 checks = 120 minutes observed.
    const { services, outages } = computeStats(checks("svc-a", "X...XXX."));
    expect(outages).toEqual([
      {
        serviceId: "svc-a",
        start: "2025-05-08T01:00:00.000Z",
        end: "2025-05-08T01:45:00.000Z",
        durationMinutes: 45,
        failedChecks: 3,
        observedChecks: 3,
      },
    ]);
    expect(computeStats(checks("svc-a", "X...XXX.")).transientFailures).toEqual([
      { serviceId: "svc-a", checkedAt: "2025-05-08T00:00:00.000Z" },
    ]);
    expect(services).toMatchObject([
      {
        serviceId: "svc-a",
        serviceName: "svc-a-api",
        observedChecks: 8,
        failedChecks: 4,
        transientFailures: 1,
        outages: 1,
        downtimeMinutes: 45,
        availabilityPct: 62.5, // 1 - 45/120
        rawSuccessPct: 50, // 4 of 8 checks passed
        slaMet: false,
        statusCodes: { "200": 4, "503": 4 },
      },
    ]);
  });

  it("meets the SLA when there are only transient failures", () => {
    const [service] = computeStats(checks("svc-a", "..X.....X...")).services;
    expect(service).toMatchObject({ availabilityPct: 100, slaMet: true, transientFailures: 2, downtimeMinutes: 0 });
    expect(service!.rawSuccessPct).toBeCloseTo(83.33, 2);
  });

  it("splits an outage that crosses a month boundary between the two months", () => {
    // 23:30 Apr 30 -> 00:15 May 1: 30 minutes in April, 15 in May.
    const { monthly } = computeStats(checks("svc-a", "..XXX..", Date.parse("2025-04-30T23:00:00Z")));
    expect(monthly.map((m) => [m.month, m.observedChecks, m.downtimeMinutes])).toEqual([
      ["2025-04", 4, 30],
      ["2025-05", 3, 15],
    ]);
  });

  it("gives each month an error budget of 0.1% of its observed minutes", () => {
    const [month] = computeStats(checks("svc-a", ".".repeat(96))).monthly;
    expect(month).toMatchObject({ observedMinutes: 1440, availabilityPct: 100, slaMet: true });
    expect(month!.errorBudgetMinutes).toBeCloseTo(1.44, 10);
    expect(month!.errorBudgetLeftMinutes).toBeCloseTo(1.44, 10);
  });

  it("summarizes latency without the null readings", () => {
    const samples = checks("svc-a", "....");
    samples[0]!.latencyMs = null;
    expect(computeStats(samples).services[0]!.latencyMs).toEqual({ p50: 102, p95: 103, p99: 103, samples: 3 });
  });

  it("returns nothing for an empty range", () => {
    expect(computeStats([])).toEqual({ services: [], monthly: [], outages: [], transientFailures: [] });
  });
});

describe("percentile (nearest rank)", () => {
  const oneToHundred = Array.from({ length: 100 }, (_, i) => i + 1);
  it.each([
    [50, 50],
    [95, 95],
    [99, 99],
    [100, 100],
    [0, 1],
  ])("p%i of 1..100 is %i", (p, expected) => {
    expect(percentile(oneToHundred, p)).toBe(expected);
  });

  it("handles one and zero values", () => {
    expect(percentile([7], 99)).toBe(7);
    expect(percentile([], 50)).toBeNull();
  });
});

describe("computeStats on the 30-day sample file", () => {
  const { checks: cleaned } = cleanChecks(readDataFile("monitoring_checks_30d_seed404.csv"));
  const { monthly, services } = computeStats(cleaned);
  const row = (serviceId: string, month: string) => monthly.find((m) => m.serviceId === serviceId && m.month === month)!;

  it("bills April and May separately (the file runs Apr 6 - May 5)", () => {
    expect([...new Set(monthly.map((m) => m.month))]).toEqual(["2025-04", "2025-05"]);
  });

  it("breaches svc-auth in April: a 375-minute outage over 2,399 observed checks", () => {
    const april = row("svc-auth", "2025-04");
    expect(april).toMatchObject({ observedChecks: 2399, downtimeMinutes: 375, slaMet: false });
    expect(april.availabilityPct).toBeCloseTo(100 * (1 - 375 / (2399 * 15)), 10);
  });

  it("keeps svc-payments within SLA despite 34 transient errors", () => {
    expect(row("svc-payments", "2025-04")).toMatchObject({ downtimeMinutes: 0, slaMet: true });
    const payments = services.find((s) => s.serviceId === "svc-payments")!;
    expect(payments).toMatchObject({ transientFailures: 34, outages: 0, slaMet: true });
    expect(payments.rawSuccessPct!).toBeLessThan(99.9);
  });
});
