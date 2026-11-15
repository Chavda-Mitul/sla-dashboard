import { describe, expect, it } from "vitest";
import { cleanChecks } from "./cleanChecks.js";
import { CsvFormatError } from "./parseCsv.js";

const HEADER = "service_id,service_name,timestamp,status_code,latency,latency_unit,agent,region";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("cleanChecks", () => {
  it("normalizes a clean file and sorts it by time", () => {
    const { checks, rejected, report } = cleanChecks(
      csv(
        "svc-a,a-api,2025-05-08T00:15:00Z,200,120,ms,agent-1,ap-south-1",
        "svc-a,a-api,2025-05-08T00:00:00Z,503,900,ms,agent-1,ap-south-1",
      ),
    );
    expect(rejected).toEqual([]);
    expect(checks.map((c) => [c.checkedAt.toISOString(), c.statusCode, c.sourceLine])).toEqual([
      ["2025-05-08T00:00:00.000Z", 503, 3],
      ["2025-05-08T00:15:00.000Z", 200, 2],
    ]);
    expect(report).toMatchObject({ totalRows: 2, acceptedRows: 2, expectedSlots: 2, coveredSlots: 2, missingSlots: 0 });
  });

  it("converts timestamp formats and latency units, recording what it changed", () => {
    const { checks, report } = cleanChecks(
      csv(
        "svc-search,search-api,1746699300,200,0.486,s,agent-1,ap-south-1",
        "svc-search,search-api,2025-05-08T16:00:00+05:30,200,0.5,s,agent-1,ap-south-1",
      ),
    );
    expect(checks.map((c) => [c.checkedAt.toISOString(), c.latencyMs, c.flags])).toEqual([
      ["2025-05-08T10:15:00.000Z", 486, ["ts_from_epoch", "latency_from_seconds"]],
      ["2025-05-08T10:30:00.000Z", 500, ["ts_from_offset", "latency_from_seconds"]],
    ]);
    expect(report.flagged).toEqual({ ts_from_epoch: 1, ts_from_offset: 1, latency_from_seconds: 2 });
  });

  it("drops an exact duplicate row", () => {
    const row = "svc-a,a-api,2025-05-08T00:00:00Z,200,120,ms,agent-1,ap-south-1";
    const { checks, rejected } = cleanChecks(csv(row, row));
    expect(checks).toHaveLength(1);
    expect(rejected).toEqual([{ sourceLine: 3, reason: "duplicate", raw: row }]);
  });

  it("catches duplicates that only match after timestamp normalization", () => {
    // Real pattern from the 30-day file: the same check written as ISO and as epoch seconds.
    const { checks, rejected } = cleanChecks(
      csv(
        "svc-a,a-api,2025-04-20T22:30:00Z,200,319,ms,agent-1,ap-south-1",
        "svc-a,a-api,1745188200,200,319,ms,agent-1,ap-south-1",
      ),
    );
    expect(checks).toHaveLength(1);
    expect(rejected).toMatchObject([{ sourceLine: 3, reason: "duplicate" }]);
  });

  it.each([
    ["first", ["", "269"]],
    ["second", ["269", ""]],
  ])("keeps the copy that has a latency reading when the %s copy is empty", (_label, [lat1, lat2]) => {
    const { checks, rejected } = cleanChecks(
      csv(
        `svc-a,a-api,2025-06-01T12:00:00Z,200,${lat1},ms,agent-1,ap-south-1`,
        `svc-a,a-api,2025-06-01T12:00:00Z,200,${lat2},ms,agent-1,ap-south-1`,
      ),
    );
    expect(checks.map((c) => c.latencyMs)).toEqual([269]);
    expect(rejected.map((r) => r.reason)).toEqual(["duplicate"]);
  });

  it("keeps the failure when the same agent reports two different outcomes", () => {
    const { checks, rejected } = cleanChecks(
      csv(
        "svc-a,a-api,2025-05-08T00:00:00Z,200,120,ms,agent-1,ap-south-1",
        "svc-a,a-api,2025-05-08T00:00:00Z,503,900,ms,agent-1,ap-south-1",
      ),
    );
    expect(checks.map((c) => c.statusCode)).toEqual([503]);
    expect(rejected).toMatchObject([{ sourceLine: 2, reason: "conflicting_duplicate" }]);
  });

  it("keeps reports from different agents for the same check", () => {
    const { checks, report } = cleanChecks(
      csv(
        "svc-a,a-api,2025-05-08T00:00:00Z,200,171,ms,agent-1,ap-south-1",
        "svc-a,a-api,2025-05-08T00:00:00Z,200,172,ms,agent-2,ap-south-1",
      ),
    );
    expect(checks.map((c) => c.agent)).toEqual(["agent-1", "agent-2"]);
    expect(report).toMatchObject({ coveredSlots: 1, multiAgentSlots: 1, agents: ["agent-1", "agent-2"] });
  });

  it("rejects bad rows individually and keeps the rest", () => {
    const { checks, report } = cleanChecks(
      csv(
        "svc-a,a-api,2025-05-08T00:00:00Z,999,389,ms,agent-1,ap-south-1",
        "svc-a,a-api,2025-05-08T00:15:00Z,200,120,ms,agent-1",
        "svc-a,a-api,2025-05-08T00:30:00,200,120,ms,agent-1,ap-south-1",
        ",a-api,2025-05-08T00:45:00Z,200,120,ms,agent-1,ap-south-1",
        "svc-a,a-api,2025-05-08T01:00:00Z,200,-286,ms,agent-1,ap-south-1",
      ),
    );
    expect(report.rejectedByReason).toEqual({
      invalid_status_code: 1,
      wrong_column_count: 1,
      invalid_timestamp: 1,
      missing_field: 1,
    });
    // The negative-latency row is kept: its status code is still valid evidence.
    expect(checks).toMatchObject([{ statusCode: 200, latencyMs: null, flags: ["latency_negative"] }]);
  });

  it("reports slots that no agent covered", () => {
    const { report } = cleanChecks(
      csv(
        "svc-a,a-api,2025-05-08T00:00:00Z,200,120,ms,agent-1,ap-south-1",
        "svc-a,a-api,2025-05-08T00:45:00Z,200,120,ms,agent-1,ap-south-1",
      ),
    );
    expect(report).toMatchObject({ expectedSlots: 4, coveredSlots: 2, missingSlots: 2 });
  });

  it("accepts any column order, upper-case headers, a BOM and CRLF line endings", () => {
    const text =
      "﻿AGENT,Region,Service_ID,service_name,timestamp,status_code,latency,latency_unit\r\n" +
      "agent-1,ap-south-1,svc-a,a-api,2025-05-08T00:00:00Z,200,120,ms\r\n\r\n";
    const { checks } = cleanChecks(text);
    expect(checks).toMatchObject([{ serviceId: "svc-a", agent: "agent-1", region: "ap-south-1", latencyMs: 120 }]);
  });

  it("returns no checks (but doesn't throw) for a header-only file", () => {
    expect(cleanChecks(HEADER).checks).toEqual([]);
  });

  it.each([
    ["an empty file", "", /empty/],
    ["a binary file", "PK\u0003\u0004\u0000\u0000", /binary/],
    ["a missing column", "service_id,timestamp,status_code\nsvc-a,2025-05-08T00:00:00Z,200", /service_name, latency, latency_unit, agent, region/],
  ])("rejects %s as a whole", (_label, text, message) => {
    expect(() => cleanChecks(text)).toThrow(CsvFormatError);
    expect(() => cleanChecks(text)).toThrow(message);
  });
});
