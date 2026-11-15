/**
 * Runs the real pipeline over the 5 sample files from the assignment.
 *
 * The expected numbers in GOLDEN come from a separate Python script written during data
 * profiling (same rules, independent code), so a bug in one implementation shows up as a
 * mismatch instead of being baked into the test.
 */
import { describe, expect, it } from "vitest";
import { cleanChecks } from "../lib/clean/cleanChecks.js";
import { SLOT_MS } from "../lib/time.js";
import { DATA_FILES, INCIDENT_LOG, readDataFile } from "./fixtures.js";

const CHECKS_PER_DAY = 96;
const SERVICES = ["svc-auth", "svc-notify", "svc-payments", "svc-reports", "svc-search"];

const GOLDEN = {
  "monitoring_checks_9d_seed101.csv": {
    totalRows: 4672,
    acceptedRows: 4664,
    flagged: { latency_from_seconds: 924, latency_missing: 56, latency_negative: 1, ts_from_epoch: 70, ts_from_offset: 32 },
    rejectedByReason: { duplicate: 7, invalid_status_code: 1 },
    expectedSlots: 4320,
    coveredSlots: 4319,
    multiAgentSlots: 345,
  },
  "monitoring_checks_12d_seed505.csv": {
    totalRows: 6230,
    acceptedRows: 6219,
    flagged: { latency_from_seconds: 1229, latency_missing: 74, latency_negative: 1, ts_from_epoch: 93, ts_from_offset: 43 },
    rejectedByReason: { duplicate: 10, invalid_status_code: 1 },
    expectedSlots: 5760,
    coveredSlots: 5759,
    multiAgentSlots: 460,
  },
  "monitoring_checks_14d_seed202.csv": {
    totalRows: 7269,
    acceptedRows: 7256,
    flagged: { latency_from_seconds: 1434, latency_missing: 87, latency_negative: 1, ts_from_epoch: 109, ts_from_offset: 50 },
    rejectedByReason: { duplicate: 12, invalid_status_code: 1 },
    expectedSlots: 6720,
    // The 999 here shares its slot with an agent-2 report of 200, so no slot is left empty.
    coveredSlots: 6720,
    multiAgentSlots: 536,
  },
  "monitoring_checks_21d_seed303.csv": {
    totalRows: 10904,
    acceptedRows: 10885,
    flagged: { latency_from_seconds: 2150, latency_missing: 130, latency_negative: 1, ts_from_epoch: 163, ts_from_offset: 76 },
    rejectedByReason: { duplicate: 18, invalid_status_code: 1 },
    expectedSlots: 10080,
    coveredSlots: 10079,
    multiAgentSlots: 806,
  },
  "monitoring_checks_30d_seed404.csv": {
    totalRows: 15577,
    acceptedRows: 15551,
    flagged: { latency_from_seconds: 3095, latency_missing: 186, latency_negative: 1, ts_from_epoch: 233, ts_from_offset: 109 },
    rejectedByReason: { duplicate: 25, invalid_status_code: 1 },
    expectedSlots: 14400,
    coveredSlots: 14399,
    multiAgentSlots: 1152,
  },
} as const;

it("covers every sample file", () => {
  expect(DATA_FILES).toEqual(Object.keys(GOLDEN).sort());
});

describe.each(DATA_FILES)("%s", (file) => {
  const { report } = cleanChecks(readDataFile(file));
  const log = INCIDENT_LOG[file]!;
  const fileStart = Date.parse(`${log.start}T00:00:00Z`);

  it("matches the independent Python profile", () => {
    const golden = GOLDEN[file as keyof typeof GOLDEN];
    expect({
      totalRows: report.totalRows,
      acceptedRows: report.acceptedRows,
      flagged: report.flagged,
      rejectedByReason: report.rejectedByReason,
      expectedSlots: report.expectedSlots,
      coveredSlots: report.coveredSlots,
      multiAgentSlots: report.multiAgentSlots,
    }).toEqual(golden);
  });

  it("spans exactly the days the incident log says, for all 5 services", () => {
    expect(report.services).toEqual(SERVICES);
    expect(report.firstCheckAt).toBe(new Date(fileStart).toISOString());
    expect(report.lastCheckAt).toBe(new Date(fileStart + log.days * CHECKS_PER_DAY * SLOT_MS - SLOT_MS).toISOString());
    expect(report.expectedSlots).toBe(SERVICES.length * log.days * CHECKS_PER_DAY);
  });

  it("only leaves a slot empty when its single report was the invalid 999", () => {
    expect(report.missingSlots).toBeLessThanOrEqual(report.rejectedByReason.invalid_status_code ?? 0);
  });
});
