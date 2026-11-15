/**
 * The contract between the api/ functions and the frontend: JSON shapes (times are ISO-8601 UTC
 * strings) plus the upload limit. No runtime dependencies, so the browser bundle can import it.
 */
import type { QualityReport, RejectedRow, RowFlag } from "./clean/types.js";

/** Vercel rejects function request bodies over 4.5 MB; the largest sample file is 1.2 MB. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export interface ApiError {
  error: string;
}

export interface DatasetSummary {
  id: string;
  filename: string;
  uploadedAt: string;
  firstCheckAt: string | null;
  lastCheckAt: string | null;
  report: QualityReport;
}

export interface UploadResponse {
  dataset: DatasetSummary;
  /** True when this exact file (same sha256) was uploaded before; nothing new was stored. */
  alreadyUploaded: boolean;
}

export interface DatasetList {
  datasets: DatasetSummary[];
}

export interface DatasetDetail {
  dataset: DatasetSummary;
  /** First rows only (see `limit`); the full count is in dataset.report.rejectedRows. */
  rejected: RejectedRow[];
  limit: number;
}

export interface OutageView {
  serviceId: string;
  start: string;
  end: string;
  durationMinutes: number;
  failedChecks: number;
  observedChecks: number;
}

export interface LatencySummary {
  p50: number | null;
  p95: number | null;
  p99: number | null;
  samples: number;
}

/** On-call view: one row per service for the selected date range. */
export interface ServiceStats {
  serviceId: string;
  serviceName: string;
  observedChecks: number;
  failedChecks: number;
  transientFailures: number;
  outages: number;
  downtimeMinutes: number;
  /** SLA availability: only outage time counts as down. null when nothing was observed. */
  availabilityPct: number | null;
  /** Share of checks that passed, counting every failure. For comparison only. */
  rawSuccessPct: number | null;
  slaMet: boolean | null;
  latencyMs: LatencySummary;
  statusCodes: Record<string, number>;
  agentDisagreements: number;
}

/** Billing view: SLAs are monthly, so one row per service per UTC calendar month. */
export interface MonthlySla {
  serviceId: string;
  month: string; // YYYY-MM
  observedChecks: number;
  observedMinutes: number;
  downtimeMinutes: number;
  availabilityPct: number;
  slaMet: boolean;
  /** Downtime allowed by the SLA over the observed minutes, and how much of it is left (negative = breached). */
  errorBudgetMinutes: number;
  errorBudgetLeftMinutes: number;
}

export interface Stats {
  from: string | null; // YYYY-MM-DD, inclusive; null = start of dataset
  to: string | null;
  slaTargetPct: number;
  services: ServiceStats[];
  monthly: MonthlySla[];
  outages: OutageView[];
}

export interface LogRow {
  checkedAt: string;
  serviceId: string;
  serviceName: string;
  agent: string;
  region: string;
  statusCode: number;
  failed: boolean;
  latencyMs: number | null;
  flags: RowFlag[];
  sourceLine: number;
}

export interface LogsPage {
  rows: LogRow[];
  total: number;
  page: number; // 0-based
  pageSize: number;
}
