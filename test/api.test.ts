/**
 * Integration tests: the real api/ handlers against a real Postgres.
 *
 * Needs TEST_DATABASE_URL pointing at a disposable database (it is emptied first); skipped
 * without it. Locally: see "Run locally" in the README for the one-line Docker Postgres.
 */
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as datasetsApi from "../api/datasets.js";
import * as logsApi from "../api/logs.js";
import * as statsApi from "../api/stats.js";
import * as uploadApi from "../api/upload.js";
import type { DatasetDetail, DatasetList, LogsPage, Stats, UploadResponse } from "../lib/apiTypes.js";
import { cleanChecks } from "../lib/clean/cleanChecks.js";
import { closeDb, db } from "../lib/db.js";
import { computeStats } from "../lib/sla/stats.js";
import { readDataFile } from "./fixtures.js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const BASE = "http://localhost/api";
const FILE = "monitoring_checks_9d_seed101.csv";
const csv = readDataFile(FILE);
const cleaned = cleanChecks(csv);

function upload(body: RequestInit["body"], filename = FILE): Promise<Response> {
  return uploadApi.POST(
    new Request(`${BASE}/upload?filename=${filename}`, { method: "POST", body, headers: { "content-type": "text/csv" } }),
  );
}

const get = (handler: (r: Request) => Promise<Response>, path: string) => handler(new Request(`${BASE}/${path}`));

describe.skipIf(!TEST_DATABASE_URL)("api against Postgres", () => {
  let datasetId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL; // db() connects lazily, on first use
    await db().query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
    await db().query("truncate datasets cascade");
  });

  afterAll(closeDb);

  describe("POST /api/upload", () => {
    it("cleans and stores a new file", async () => {
      const response = await upload(csv);
      expect(response.status).toBe(201);
      const body = (await response.json()) as UploadResponse;
      expect(body.alreadyUploaded).toBe(false);
      expect(body.dataset).toMatchObject({ filename: FILE, report: cleaned.report });
      datasetId = body.dataset.id;

      const { rows } = await db().query("select count(*)::int as n from checks where dataset_id = $1", [datasetId]);
      expect(rows[0].n).toBe(cleaned.checks.length);
    });

    it("recognizes the same file uploaded again and stores nothing new", async () => {
      const response = await upload(csv, "renamed.csv");
      expect(response.status).toBe(200);
      const body = (await response.json()) as UploadResponse;
      expect(body).toMatchObject({ alreadyUploaded: true, dataset: { id: datasetId, filename: FILE } });
      const { rows } = await db().query("select count(*)::int as n from datasets");
      expect(rows[0].n).toBe(1);
    });

    it.each([
      ["an empty body", "", 400, /empty/],
      ["a binary file", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]), 400, /binary/],
      ["a CSV with the wrong columns", "id,name\n1,a\n", 400, /Missing required column/],
      ["a CSV where every row is invalid", csv.split("\n")[0] + "\nsvc-a,a,not-a-date,200,1,ms,a1,r1\n", 400, /No valid rows/],
      ["a file over 4 MB", "x".repeat(4 * 1024 * 1024 + 1), 413, /larger than 4 MB/],
    ])("rejects %s", async (_label, body, status, message) => {
      const response = await upload(body as RequestInit["body"], "bad.csv");
      expect(response.status).toBe(status);
      expect(((await response.json()) as { error: string }).error).toMatch(message);
    });
  });

  describe("GET /api/datasets", () => {
    it("lists datasets", async () => {
      const body = (await (await get(datasetsApi.GET, "datasets")).json()) as DatasetList;
      expect(body.datasets.map((d) => d.id)).toEqual([datasetId]);
    });

    it("returns one dataset with its rejected rows", async () => {
      const body = (await (await get(datasetsApi.GET, `datasets?id=${datasetId}`)).json()) as DatasetDetail;
      expect(body.rejected).toEqual(cleaned.rejected);
    });

    it("404s for an unknown id and 400s for a malformed one", async () => {
      expect((await get(datasetsApi.GET, "datasets?id=00000000-0000-4000-8000-000000000000")).status).toBe(404);
      expect((await get(datasetsApi.GET, "datasets?id=nope")).status).toBe(400);
    });
  });

  describe("GET /api/stats", () => {
    it("matches the in-memory computation for the whole dataset (the DB round trip loses nothing)", async () => {
      const body = (await (await get(statsApi.GET, `stats?datasetId=${datasetId}`)).json()) as Stats;
      expect(body).toEqual({ from: null, to: null, slaTargetPct: 99.9, ...computeStats(cleaned.checks) });
    });

    it("filters to a single date", async () => {
      const body = (await (await get(statsApi.GET, `stats?datasetId=${datasetId}&from=2025-05-13&to=2025-05-13`)).json()) as Stats;
      expect(body.outages).toEqual([
        expect.objectContaining({ serviceId: "svc-reports", start: "2025-05-13T16:00:00.000Z", end: "2025-05-13T18:15:00.000Z" }),
      ]);
      expect(body.services.map((s) => s.observedChecks)).toEqual([96, 96, 96, 96, 96]);
    });

    it.each([
      ["from after to", "&from=2025-05-14&to=2025-05-13", 400],
      ["an impossible date", "&from=2025-02-30", 400],
    ])("400s for %s", async (_label, query, status) => {
      expect((await get(statsApi.GET, `stats?datasetId=${datasetId}${query}`)).status).toBe(status);
    });

    it("404s for an unknown dataset", async () => {
      expect((await get(statsApi.GET, "stats?datasetId=00000000-0000-4000-8000-000000000000")).status).toBe(404);
    });
  });

  describe("GET /api/logs", () => {
    const inDays = (from: string, to: string) =>
      cleaned.checks.filter((c) => {
        const day = c.checkedAt.toISOString().slice(0, 10);
        return day >= from && day <= to;
      });

    it("pages through every check in time order", async () => {
      const body = (await (await get(logsApi.GET, `logs?datasetId=${datasetId}&page=1&pageSize=50`)).json()) as LogsPage;
      expect(body.total).toBe(cleaned.checks.length);
      expect(body.rows.map((r) => r.sourceLine)).toEqual(cleaned.checks.slice(50, 100).map((c) => c.sourceLine));
    });

    it("filters by a date range", async () => {
      const body = (await (await get(logsApi.GET, `logs?datasetId=${datasetId}&from=2025-05-08&to=2025-05-09`)).json()) as LogsPage;
      expect(body.total).toBe(inDays("2025-05-08", "2025-05-09").length);
    });

    it("filters by single date, service and failures only", async () => {
      const query = `logs?datasetId=${datasetId}&from=2025-05-13&to=2025-05-13&service=svc-reports&failedOnly=true`;
      const body = (await (await get(logsApi.GET, query)).json()) as LogsPage;
      const expected = inDays("2025-05-13", "2025-05-13").filter((c) => c.serviceId === "svc-reports" && c.statusCode >= 500);
      expect(body.total).toBe(expected.length);
      expect(body.rows.every((r) => r.failed && r.serviceId === "svc-reports")).toBe(true);
    });

    it("keeps each row's cleaning flags", async () => {
      const body = (await (await get(logsApi.GET, `logs?datasetId=${datasetId}&pageSize=500`)).json()) as LogsPage;
      const bySourceLine = new Map(cleaned.checks.map((c) => [c.sourceLine, c]));
      for (const row of body.rows) {
        const original = bySourceLine.get(row.sourceLine)!;
        expect(row).toMatchObject({ flags: original.flags, latencyMs: original.latencyMs, statusCode: original.statusCode });
      }
    });
  });
});
