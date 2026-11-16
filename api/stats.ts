/**
 * GET /api/stats?datasetId=<uuid>[&from=YYYY-MM-DD][&to=YYYY-MM-DD]
 *
 * SLA, outage, latency and error stats for the selected range, computed on request from the
 * stored checks with the same lib/sla code the tests cover (at most ~15k rows per dataset).
 */
import type { Stats } from "../lib/apiTypes.js";
import { handle, HttpError, json, queryOf, rangeQuery, toTimeRange } from "../lib/http.js";
import { SLA_TARGET_PCT } from "../lib/sla/policy.js";
import { computeStats } from "../lib/sla/stats.js";
import { getDataset, loadCheckSamples } from "../lib/store.js";

export function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { datasetId, from, to } = rangeQuery.parse(queryOf(request));
    if (!(await getDataset(datasetId))) throw new HttpError(404, "Dataset not found");

    const samples = await loadCheckSamples(datasetId, toTimeRange(from, to));
    return json({
      from: from ?? null,
      to: to ?? null,
      slaTargetPct: SLA_TARGET_PCT,
      ...computeStats(samples),
    } satisfies Stats);
  });
}
