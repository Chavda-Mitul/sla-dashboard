/**
 * POST /api/upload?filename=checks.csv   body: the raw CSV (Content-Type: text/csv)
 *
 * The stateless processing step: parse, validate and clean the file, then store it.
 * Nothing is kept in memory between requests; everything goes to Postgres.
 *
 * 201 new dataset | 200 same file uploaded before | 400 not a usable CSV | 413 too large
 */
import { createHash } from "node:crypto";
import { MAX_UPLOAD_BYTES, type UploadResponse } from "../lib/apiTypes.js";
import { cleanChecks } from "../lib/clean/cleanChecks.js";
import { handle, HttpError, json } from "../lib/http.js";
import { findDatasetByHash, saveDataset } from "../lib/store.js";

export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_UPLOAD_BYTES) throw tooLarge();

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES) throw tooLarge();
    if (bytes.byteLength === 0) throw new HttpError(400, "The file is empty");

    const filename = (new URL(request.url).searchParams.get("filename") ?? "upload.csv").slice(0, 200);
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    const existing = await findDatasetByHash(sha256);
    if (existing) return json({ dataset: existing, alreadyUploaded: true } satisfies UploadResponse, 200);

    const result = cleanChecks(new TextDecoder().decode(bytes)); // throws CsvFormatError -> 400
    if (result.checks.length === 0) {
      const rows = result.report.totalRows.toLocaleString("en-US");
      throw new HttpError(400, `No valid rows: all ${rows} rows were rejected`);
    }

    const { dataset, created } = await saveDataset({ filename, sha256, result });
    return json({ dataset, alreadyUploaded: !created } satisfies UploadResponse, created ? 201 : 200);
  });
}

function tooLarge(): HttpError {
  return new HttpError(413, `File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
}
