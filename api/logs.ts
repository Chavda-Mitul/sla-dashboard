/**
 * GET /api/logs?datasetId=<uuid>[&from=YYYY-MM-DD][&to=YYYY-MM-DD][&service=svc-x][&failedOnly=true][&page=0][&pageSize=100]
 *
 * The underlying check records, one row per agent report, oldest first, paginated.
 * A single date is from = to.
 */
import { handle, json, logsQuery, queryOf, toTimeRange } from "../lib/http.js";
import { queryLogs } from "../lib/store.js";

export function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const query = logsQuery.parse(queryOf(request));
    const page = await queryLogs({
      datasetId: query.datasetId,
      range: toTimeRange(query.from, query.to),
      serviceId: query.service,
      failedOnly: query.failedOnly,
      page: query.page,
      pageSize: query.pageSize,
    });
    return json(page);
  });
}
