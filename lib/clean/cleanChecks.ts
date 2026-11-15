import { isFailure } from "../sla/policy.js";
import { SLOT_MS } from "../time.js";
import { parseLatency, parseStatus, parseTimestamp } from "./normalize.js";
import { parseCsv, type ParsedCsv, type ParsedRow } from "./parseCsv.js";
import type { Check, CleanResult, Column, QualityReport, RejectReason, RejectedRow, RowFlag } from "./types.js";

type Candidate = { check: Check; raw: string };
type RowOutcome = { ok: true; check: Check } | { ok: false; reason: RejectReason };

/**
 * Turns an uploaded CSV into clean, de-duplicated checks plus an audit trail of everything
 * that was fixed or dropped. Pure (no I/O), so the serverless function and the tests run
 * exactly the same code.
 *
 * Throws CsvFormatError when the file as a whole is unusable.
 */
export function cleanChecks(csvText: string): CleanResult {
  const { columnIndex, headerLength, rows } = parseCsv(csvText);
  const rejected: RejectedRow[] = [];
  const flagged: Partial<Record<RowFlag, number>> = {};
  const valid: Candidate[] = [];

  for (const row of rows) {
    const outcome = normalizeRow(row, columnIndex, headerLength);
    if (!outcome.ok) {
      rejected.push({ sourceLine: row.line, reason: outcome.reason, raw: row.raw });
      continue;
    }
    for (const flag of outcome.check.flags) increment(flagged, flag);
    valid.push({ check: outcome.check, raw: row.raw });
  }

  const checks = dedupe(valid, rejected).sort(byTimeServiceAgent);
  rejected.sort((a, b) => a.sourceLine - b.sourceLine);

  return { checks, rejected, report: buildReport(rows.length, checks, rejected, flagged) };
}

function normalizeRow(row: ParsedRow, columnIndex: ParsedCsv["columnIndex"], headerLength: number): RowOutcome {
  if (row.values.length !== headerLength) return { ok: false, reason: "wrong_column_count" };
  const field = (column: Column) => row.values[columnIndex[column]] ?? "";

  const serviceId = field("service_id");
  const serviceName = field("service_name");
  const agent = field("agent");
  const region = field("region");
  if (!serviceId || !serviceName || !agent || !region) return { ok: false, reason: "missing_field" };

  const timestamp = parseTimestamp(field("timestamp"));
  if (!timestamp.ok) return { ok: false, reason: timestamp.reason };

  const statusCode = parseStatus(field("status_code"));
  if (statusCode === null) return { ok: false, reason: "invalid_status_code" };

  const latency = parseLatency(field("latency"), field("latency_unit"));

  const flags: RowFlag[] = [];
  if (timestamp.flag) flags.push(timestamp.flag);
  if (latency.flag) flags.push(latency.flag);

  return {
    ok: true,
    check: {
      serviceId,
      serviceName,
      checkedAt: timestamp.date,
      statusCode,
      latencyMs: latency.ms,
      agent,
      region,
      sourceLine: row.line,
      flags,
    },
  };
}

/**
 * Keeps one report per (service, time, agent). This has to run after timestamp normalization:
 * some duplicates are the same check written once as epoch seconds and once as ISO.
 *
 * Reports from *different* agents are all kept. They are independent observations (and the
 * logs view shows them); resolveSlots() later merges them into one up/down verdict per slot.
 */
function dedupe(valid: Candidate[], rejected: RejectedRow[]): Check[] {
  const kept = new Map<string, Candidate>();

  for (const candidate of valid) {
    const { check } = candidate;
    const key = `${check.serviceId}|${check.checkedAt.getTime()}|${check.agent}`;
    const existing = kept.get(key);
    if (!existing) {
      kept.set(key, candidate);
      continue;
    }
    const [winner, loser, reason] = pickBetter(existing, candidate);
    kept.set(key, winner);
    rejected.push({ sourceLine: loser.check.sourceLine, reason, raw: loser.raw });
  }

  return [...kept.values()].map(({ check }) => check);
}

/** Two reports of the same check by the same agent: which one do we keep? `a` came first in the file. */
function pickBetter(a: Candidate, b: Candidate): [winner: Candidate, loser: Candidate, reason: RejectReason] {
  const [first, second] = [a.check, b.check];

  if (first.statusCode !== second.statusCode) {
    // Different outcomes: keep the failure, so a bad copy can never hide an outage.
    const keepSecond = isFailure(second.statusCode) && !isFailure(first.statusCode);
    return keepSecond ? [b, a, "conflicting_duplicate"] : [a, b, "conflicting_duplicate"];
  }

  if (first.latencyMs === null || second.latencyMs === null || first.latencyMs === second.latencyMs) {
    // Same outcome. Keep whichever copy has a latency reading (the first one if both or neither do).
    const keepSecond = first.latencyMs === null && second.latencyMs !== null;
    return keepSecond ? [b, a, "duplicate"] : [a, b, "duplicate"];
  }

  // Same outcome but two different latency readings: keep the first and record the clash.
  return [a, b, "conflicting_duplicate"];
}

function buildReport(
  totalRows: number,
  checks: Check[],
  rejected: RejectedRow[],
  flagged: Partial<Record<RowFlag, number>>,
): QualityReport {
  const rejectedByReason: Partial<Record<RejectReason, number>> = {};
  for (const { reason } of rejected) increment(rejectedByReason, reason);

  const agentsPerSlot = new Map<string, Set<string>>();
  for (const check of checks) {
    const key = `${check.serviceId}|${check.checkedAt.getTime()}`;
    const agents = agentsPerSlot.get(key) ?? new Set<string>();
    agents.add(check.agent);
    agentsPerSlot.set(key, agents);
  }

  const services = uniqueSorted(checks.map((c) => c.serviceId));
  const first = checks[0]?.checkedAt ?? null;
  const last = checks.at(-1)?.checkedAt ?? null;
  // Assumes every service should be checked for the whole span covered by the file.
  const slotsPerService = first && last ? (last.getTime() - first.getTime()) / SLOT_MS + 1 : 0;
  const expectedSlots = services.length * slotsPerService;

  return {
    totalRows,
    acceptedRows: checks.length,
    rejectedRows: rejected.length,
    rejectedByReason,
    flagged,
    services,
    agents: uniqueSorted(checks.map((c) => c.agent)),
    firstCheckAt: first?.toISOString() ?? null,
    lastCheckAt: last?.toISOString() ?? null,
    expectedSlots,
    coveredSlots: agentsPerSlot.size,
    missingSlots: expectedSlots - agentsPerSlot.size,
    multiAgentSlots: [...agentsPerSlot.values()].filter((agents) => agents.size > 1).length,
  };
}

function byTimeServiceAgent(a: Check, b: Check): number {
  return (
    a.checkedAt.getTime() - b.checkedAt.getTime() ||
    compareStrings(a.serviceId, b.serviceId) ||
    compareStrings(a.agent, b.agent)
  );
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function increment<K extends string>(counts: Partial<Record<K, number>>, key: K): void {
  counts[key] = (counts[key] ?? 0) + 1;
}
