/** All SQL lives here. Every query is parameterized. */
import { randomUUID } from "node:crypto";
import type { DatasetSummary, LogRow, LogsPage } from "./apiTypes.js";
import type { CleanResult, QualityReport, RejectedRow, RowFlag } from "./clean/types.js";
import { db } from "./db.js";
import { FAILURE_MIN_STATUS } from "./sla/policy.js";
import type { CheckSample } from "./sla/stats.js";

/** Rows per INSERT. 15k checks go in as 4 statements instead of 15k. */
const INSERT_CHUNK = 5000;

/** A time window: start inclusive, end exclusive; null = unbounded. */
export interface TimeRange {
  start: Date | null;
  end: Date | null;
}

interface DatasetRow {
  id: string;
  filename: string;
  uploaded_at: Date;
  first_check_at: Date | null;
  last_check_at: Date | null;
  report: QualityReport;
}

const DATASET_COLUMNS = "id, filename, uploaded_at, first_check_at, last_check_at, report";

function toDataset(row: DatasetRow): DatasetSummary {
  return {
    id: row.id,
    filename: row.filename,
    uploadedAt: row.uploaded_at.toISOString(),
    firstCheckAt: row.first_check_at?.toISOString() ?? null,
    lastCheckAt: row.last_check_at?.toISOString() ?? null,
    report: row.report,
  };
}

export async function listDatasets(): Promise<DatasetSummary[]> {
  const { rows } = await db().query<DatasetRow>(`select ${DATASET_COLUMNS} from datasets order by uploaded_at desc`);
  return rows.map(toDataset);
}

export async function getDataset(id: string): Promise<DatasetSummary | null> {
  const { rows } = await db().query<DatasetRow>(`select ${DATASET_COLUMNS} from datasets where id = $1`, [id]);
  return rows[0] ? toDataset(rows[0]) : null;
}

export async function findDatasetByHash(sha256: string): Promise<DatasetSummary | null> {
  const { rows } = await db().query<DatasetRow>(`select ${DATASET_COLUMNS} from datasets where file_sha256 = $1`, [
    sha256,
  ]);
  return rows[0] ? toDataset(rows[0]) : null;
}

/**
 * Stores a cleaned upload in one transaction: either the dataset, all its checks and all its
 * rejected rows are saved, or nothing is. If the same file is being saved concurrently, the
 * unique hash makes the second attempt return the first one's dataset.
 */
export async function saveDataset(input: {
  filename: string;
  sha256: string;
  result: CleanResult;
}): Promise<{ dataset: DatasetSummary; created: boolean }> {
  const { filename, sha256, result } = input;
  const client = await db().connect();
  try {
    await client.query("begin");

    const inserted = await client.query<DatasetRow>(
      `insert into datasets (id, filename, file_sha256, first_check_at, last_check_at, report)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (file_sha256) do nothing
       returning ${DATASET_COLUMNS}`,
      [randomUUID(), filename, sha256, result.report.firstCheckAt, result.report.lastCheckAt, result.report],
    );
    const row = inserted.rows[0];
    if (!row) {
      await client.query("rollback");
      const existing = await findDatasetByHash(sha256);
      if (!existing) throw new Error("Dataset hash conflict, but no existing dataset found");
      return { dataset: existing, created: false };
    }

    for (const chunk of chunks(result.checks, INSERT_CHUNK)) {
      // unnest() turns one array per column into rows. Flags are sent as comma-joined text
      // because unnest would flatten an array of arrays.
      await client.query(
        `insert into checks (dataset_id, service_id, service_name, checked_at, agent, region,
                             status_code, latency_ms, source_line, flags)
         select $1, u.service_id, u.service_name, u.checked_at, u.agent, u.region,
                u.status_code, u.latency_ms, u.source_line, string_to_array(u.flags, ',')
         from unnest($2::text[], $3::text[], $4::timestamptz[], $5::text[], $6::text[],
                     $7::smallint[], $8::int[], $9::int[], $10::text[])
              as u(service_id, service_name, checked_at, agent, region, status_code, latency_ms, source_line, flags)`,
        [
          row.id,
          chunk.map((c) => c.serviceId),
          chunk.map((c) => c.serviceName),
          chunk.map((c) => c.checkedAt.toISOString()),
          chunk.map((c) => c.agent),
          chunk.map((c) => c.region),
          chunk.map((c) => c.statusCode),
          chunk.map((c) => c.latencyMs),
          chunk.map((c) => c.sourceLine),
          chunk.map((c) => c.flags.join(",")),
        ],
      );
    }

    for (const chunk of chunks(result.rejected, INSERT_CHUNK)) {
      await client.query(
        `insert into rejected_rows (dataset_id, source_line, reason, raw)
         select $1, * from unnest($2::int[], $3::text[], $4::text[])`,
        [row.id, chunk.map((r) => r.sourceLine), chunk.map((r) => r.reason), chunk.map((r) => r.raw)],
      );
    }

    await client.query("commit");
    return { dataset: toDataset(row), created: true };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** The columns stats need, for one dataset and time range. */
export async function loadCheckSamples(datasetId: string, range: TimeRange): Promise<CheckSample[]> {
  const { rows } = await db().query<{
    service_id: string;
    service_name: string;
    checked_at: Date;
    status_code: number;
    latency_ms: number | null;
  }>(
    `select service_id, service_name, checked_at, status_code, latency_ms
     from checks
     where dataset_id = $1
       and ($2::timestamptz is null or checked_at >= $2)
       and ($3::timestamptz is null or checked_at < $3)`,
    [datasetId, range.start, range.end],
  );
  return rows.map((r) => ({
    serviceId: r.service_id,
    serviceName: r.service_name,
    checkedAt: r.checked_at,
    statusCode: r.status_code,
    latencyMs: r.latency_ms,
  }));
}

export interface LogsQuery {
  datasetId: string;
  range: TimeRange;
  serviceId?: string | undefined;
  failedOnly: boolean;
  page: number;
  pageSize: number;
}

export async function queryLogs(query: LogsQuery): Promise<LogsPage> {
  const where = `
    where dataset_id = $1
      and ($2::timestamptz is null or checked_at >= $2)
      and ($3::timestamptz is null or checked_at < $3)
      and ($4::text is null or service_id = $4)
      and (not $5::boolean or status_code >= $6)`;
  const params = [
    query.datasetId,
    query.range.start,
    query.range.end,
    query.serviceId ?? null,
    query.failedOnly,
    FAILURE_MIN_STATUS,
  ];

  const [page, count] = await Promise.all([
    db().query<{
      checked_at: Date;
      service_id: string;
      service_name: string;
      agent: string;
      region: string;
      status_code: number;
      latency_ms: number | null;
      flags: string[];
      source_line: number;
    }>(
      `select checked_at, service_id, service_name, agent, region, status_code, latency_ms, flags, source_line
       from checks ${where}
       order by checked_at, service_id, agent
       limit $7 offset $8`,
      [...params, query.pageSize, query.page * query.pageSize],
    ),
    db().query<{ total: number }>(`select count(*)::int as total from checks ${where}`, params),
  ]);

  return {
    rows: page.rows.map(
      (r): LogRow => ({
        checkedAt: r.checked_at.toISOString(),
        serviceId: r.service_id,
        serviceName: r.service_name,
        agent: r.agent,
        region: r.region,
        statusCode: r.status_code,
        failed: r.status_code >= FAILURE_MIN_STATUS,
        latencyMs: r.latency_ms,
        flags: r.flags as RowFlag[],
        sourceLine: r.source_line,
      }),
    ),
    total: count.rows[0]?.total ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listRejected(datasetId: string, limit: number): Promise<RejectedRow[]> {
  const { rows } = await db().query<{ source_line: number; reason: RejectedRow["reason"]; raw: string }>(
    `select source_line, reason, raw from rejected_rows where dataset_id = $1 order by source_line limit $2`,
    [datasetId, limit],
  );
  return rows.map((r) => ({ sourceLine: r.source_line, reason: r.reason, raw: r.raw }));
}

function* chunks<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}
