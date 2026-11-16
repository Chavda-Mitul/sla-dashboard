import type { DailyHealth, MonthlySla, OutageView, ServiceStats, Stats, TrendPoint } from "../apiTypes.js";
import type { Check } from "../clean/types.js";
import { SLOT_MINUTES } from "../time.js";
import { detectOutages, type Outage, type OutageRules } from "./outages.js";
import { isFailure, OUTAGE_RULES, SLA_TARGET_PCT } from "./policy.js";
import { resolveSlots, type Slot } from "./slots.js";

/** The columns stats need; this is what the stats function loads from the database. */
export type CheckSample = Pick<Check, "serviceId" | "serviceName" | "checkedAt" | "statusCode" | "latencyMs">;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * Everything the dashboard's stats section shows, computed from the checks in the selected
 * range. Uses the same slot/outage code that is tested against the incident log.
 *
 * Availability uses the *observed* time as the denominator: if a file only covers part of a
 * month, the SLA is judged on the part we have data for, not on assumed-good unobserved time.
 */
export function computeStats(
  checks: CheckSample[],
  rules: OutageRules = OUTAGE_RULES,
): Pick<Stats, "services" | "monthly" | "outages" | "transientFailures" | "daily" | "trendBucketMinutes" | "trends"> {
  const slots = resolveSlots(checks);
  const { outages, transientFailures } = detectOutages(slots, rules);
  const serviceIds = [...new Set(slots.map((s) => s.serviceId))].sort();
  const bucketMinutes = trendBucketMinutes(slots);

  const services = serviceIds.map((serviceId): ServiceStats => {
    const serviceChecks = checks.filter((c) => c.serviceId === serviceId);
    const serviceSlots = slots.filter((s) => s.serviceId === serviceId);
    const serviceOutages = outages.filter((o) => o.serviceId === serviceId);
    const failedChecks = serviceSlots.filter((s) => s.failed).length;
    const downtimeMinutes = sum(serviceOutages.map(durationMinutes));
    const availabilityPct = availability(serviceSlots.length, downtimeMinutes);

    return {
      serviceId,
      serviceName: serviceChecks[0]?.serviceName ?? serviceId,
      observedChecks: serviceSlots.length,
      failedChecks,
      transientFailures: transientFailures.filter((s) => s.serviceId === serviceId).length,
      outages: serviceOutages.length,
      downtimeMinutes,
      availabilityPct,
      rawSuccessPct: serviceSlots.length ? (100 * (serviceSlots.length - failedChecks)) / serviceSlots.length : null,
      slaMet: availabilityPct === null ? null : availabilityPct >= SLA_TARGET_PCT,
      latencyMs: latencySummary(serviceChecks),
      statusCodes: countStatusCodes(serviceChecks),
      agentDisagreements: serviceSlots.filter((s) => s.disagreement).length,
    };
  });

  return {
    services,
    monthly: serviceIds.flatMap((serviceId) =>
      monthlySla(
        serviceId,
        slots.filter((s) => s.serviceId === serviceId),
        outages.filter((o) => o.serviceId === serviceId),
      ),
    ),
    outages: outages.map(
      (o): OutageView => ({
        serviceId: o.serviceId,
        start: o.start.toISOString(),
        end: o.end.toISOString(),
        durationMinutes: durationMinutes(o),
        failedChecks: o.failedChecks,
        observedChecks: o.observedChecks,
        errorCodes: countStatusCodes(
          checks.filter(
            (c) =>
              c.serviceId === o.serviceId &&
              isFailure(c.statusCode) &&
              c.checkedAt.getTime() >= o.start.getTime() &&
              c.checkedAt.getTime() < o.end.getTime(),
          ),
        ),
      }),
    ),
    transientFailures: transientFailures.map((s) => ({ serviceId: s.serviceId, checkedAt: s.checkedAt.toISOString() })),
    daily: serviceIds.flatMap((serviceId) =>
      dailyHealth(
        serviceId,
        slots.filter((s) => s.serviceId === serviceId),
        outages.filter((o) => o.serviceId === serviceId),
      ),
    ),
    trendBucketMinutes: bucketMinutes,
    trends: serviceIds.map((serviceId) => ({
      serviceId,
      points: trend(
        checks.filter((c) => c.serviceId === serviceId),
        slots.filter((s) => s.serviceId === serviceId),
        bucketMinutes,
      ),
    })),
  };
}

/** Coarser buckets for longer ranges, so a month stays around 120 points per service. */
export function trendBucketMinutes(slots: Pick<Slot, "checkedAt">[]): number {
  if (slots.length === 0) return 60;
  const times = slots.map((s) => s.checkedAt.getTime());
  const days = (Math.max(...times) - Math.min(...times)) / DAY_MS;
  return days <= 2 ? 60 : days <= 10 ? 180 : 360;
}

function dailyHealth(serviceId: string, serviceSlots: Slot[], serviceOutages: Outage[]): DailyHealth[] {
  const days = new Map<string, Slot[]>();
  for (const slot of serviceSlots) {
    const day = slot.checkedAt.toISOString().slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), slot]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, daySlots]) => {
      const dayStart = Date.parse(`${day}T00:00:00Z`);
      const downtimeMinutes = sum(
        serviceOutages.map((o) => overlapMinutes(o.start.getTime(), o.end.getTime(), dayStart, dayStart + DAY_MS)),
      );
      return {
        serviceId,
        day,
        observedChecks: daySlots.length,
        failedChecks: daySlots.filter((s) => s.failed).length,
        downtimeMinutes,
        availabilityPct: availability(daySlots.length, downtimeMinutes) ?? 100,
      };
    });
}

function trend(serviceChecks: CheckSample[], serviceSlots: Slot[], bucketMinutes: number): TrendPoint[] {
  const bucketMs = bucketMinutes * MINUTE_MS;
  const bucketOf = (date: Date) => Math.floor(date.getTime() / bucketMs) * bucketMs;
  const buckets = new Map<number, { checks: number; failedChecks: number; latencies: number[] }>();
  const at = (key: number) => {
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = { checks: 0, failedChecks: 0, latencies: [] }));
    return bucket;
  };
  for (const slot of serviceSlots) {
    const bucket = at(bucketOf(slot.checkedAt));
    bucket.checks += 1;
    if (slot.failed) bucket.failedChecks += 1;
  }
  for (const check of serviceChecks) {
    if (check.latencyMs !== null) at(bucketOf(check.checkedAt)).latencies.push(check.latencyMs);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, b]) => ({
      start: new Date(start).toISOString(),
      checks: b.checks,
      failedChecks: b.failedChecks,
      p95LatencyMs: percentile(b.latencies.sort((x, y) => x - y), 95),
    }));
}

function monthlySla(serviceId: string, serviceSlots: Slot[], serviceOutages: Outage[]): MonthlySla[] {
  const months = [...new Set(serviceSlots.map((s) => monthOf(s.checkedAt)))].sort();

  return months.map((month) => {
    const [year, monthNumber] = month.split("-").map(Number) as [number, number];
    const monthStart = Date.UTC(year, monthNumber - 1, 1);
    const monthEnd = Date.UTC(year, monthNumber, 1);

    const observedChecks = serviceSlots.filter((s) => monthOf(s.checkedAt) === month).length;
    const observedMinutes = observedChecks * SLOT_MINUTES;
    // An outage that crosses midnight at the end of a month is split between the two months.
    const downtimeMinutes = sum(
      serviceOutages.map((o) => overlapMinutes(o.start.getTime(), o.end.getTime(), monthStart, monthEnd)),
    );
    const availabilityPct = availability(observedChecks, downtimeMinutes) ?? 100;
    const errorBudgetMinutes = observedMinutes * (1 - SLA_TARGET_PCT / 100);

    return {
      serviceId,
      month,
      observedChecks,
      observedMinutes,
      downtimeMinutes,
      availabilityPct,
      slaMet: availabilityPct >= SLA_TARGET_PCT,
      errorBudgetMinutes,
      errorBudgetLeftMinutes: errorBudgetMinutes - downtimeMinutes,
    };
  });
}

function availability(observedChecks: number, downtimeMinutes: number): number | null {
  if (observedChecks === 0) return null;
  const observedMinutes = observedChecks * SLOT_MINUTES;
  return Math.max(0, 100 * (1 - downtimeMinutes / observedMinutes));
}

function latencySummary(checks: CheckSample[]) {
  const values = checks
    .map((c) => c.latencyMs)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  return {
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    samples: values.length,
  };
}

/** Nearest-rank percentile of an already sorted list. */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(rank, 1)) - 1]!;
}

function countStatusCodes(checks: CheckSample[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { statusCode } of checks) counts[statusCode] = (counts[statusCode] ?? 0) + 1;
  return counts;
}

function durationMinutes(outage: Pick<Outage, "start" | "end">): number {
  return (outage.end.getTime() - outage.start.getTime()) / MINUTE_MS;
}

function overlapMinutes(start: number, end: number, rangeStart: number, rangeEnd: number): number {
  return Math.max(0, Math.min(end, rangeEnd) - Math.max(start, rangeStart)) / MINUTE_MS;
}

function monthOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
