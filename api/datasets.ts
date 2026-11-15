/**
 * GET /api/datasets           -> every uploaded dataset, newest first
 * GET /api/datasets?id=<uuid> -> one dataset with its quality report and first rejected rows
 */
import { z } from "zod";
import type { DatasetDetail, DatasetList } from "../lib/apiTypes.js";
import { handle, HttpError, json, queryOf } from "../lib/http.js";
import { getDataset, listDatasets, listRejected } from "../lib/store.js";

const REJECTED_LIMIT = 500;

export function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const query = queryOf(request);
    if (!query.id) return json({ datasets: await listDatasets() } satisfies DatasetList);

    const { id } = z.object({ id: z.uuid() }).parse(query);
    const dataset = await getDataset(id);
    if (!dataset) throw new HttpError(404, "Dataset not found");

    const rejected = await listRejected(id, REJECTED_LIMIT);
    return json({ dataset, rejected, limit: REJECTED_LIMIT } satisfies DatasetDetail);
  });
}
