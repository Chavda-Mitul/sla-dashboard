/** Columns every upload must contain. Matched case-insensitively, in any order; extra columns are ignored. */
export const REQUIRED_COLUMNS = [
  "service_id",
  "service_name",
  "timestamp",
  "status_code",
  "latency",
  "latency_unit",
  "agent",
  "region",
] as const;

export type Column = (typeof REQUIRED_COLUMNS)[number];

/** Something we normalized or noticed on a row that we still kept. */
export type RowFlag =
  | "ts_from_epoch" // timestamp was Unix epoch seconds
  | "ts_from_offset" // timestamp carried a non-Z offset (e.g. +05:30) and was converted to UTC
  | "latency_from_seconds" // latency_unit was "s"; converted to ms
  | "latency_missing" // latency cell empty -> stored as null
  | "latency_negative" // impossible value -> stored as null
  | "latency_invalid" // not a number -> stored as null
  | "latency_unknown_unit"; // unit other than ms/s -> stored as null

/** Why a row was dropped entirely (it never reaches the checks table). */
export type RejectReason =
  | "wrong_column_count"
  | "missing_field"
  | "invalid_timestamp"
  | "off_grid_timestamp"
  | "invalid_status_code"
  | "duplicate" // same service + time + agent as a row we kept, same outcome
  | "conflicting_duplicate"; // same service + time + agent as a row we kept, but a different outcome

/** One cleaned health-check report from one agent. */
export interface Check {
  serviceId: string;
  serviceName: string;
  checkedAt: Date; // always UTC, always on the 15-minute grid
  statusCode: number;
  latencyMs: number | null; // integer milliseconds; null when the source value was unusable
  agent: string;
  region: string;
  sourceLine: number; // line in the uploaded file, header = line 1
  flags: RowFlag[];
}

export interface RejectedRow {
  sourceLine: number;
  reason: RejectReason;
  raw: string; // the original line, for auditing
}

export interface QualityReport {
  totalRows: number; // data rows in the file (header and blank lines excluded)
  acceptedRows: number;
  rejectedRows: number;
  rejectedByReason: Partial<Record<RejectReason, number>>;
  /** Counted on every row that passed validation, before de-duplication: describes the input. */
  flagged: Partial<Record<RowFlag, number>>;
  services: string[];
  agents: string[];
  firstCheckAt: string | null; // ISO-8601 UTC
  lastCheckAt: string | null;
  /** services x 15-minute slots between the first and last check. */
  expectedSlots: number;
  /** Distinct (service, time) slots with at least one accepted report. */
  coveredSlots: number;
  missingSlots: number;
  /** Slots reported by more than one agent. */
  multiAgentSlots: number;
}

export interface CleanResult {
  checks: Check[];
  rejected: RejectedRow[];
  report: QualityReport;
}
