import type {
  ApiError,
  DatasetDetail,
  DatasetList,
  LogsPage,
  Stats,
  UploadResponse,
} from "../lib/apiTypes";

/** Same origin: Vercel serves api/ next to the static site, and `npm run dev` does the same. */
const BASE = "/api";

export interface RangeParams {
  datasetId: string;
  from?: string | undefined;
  to?: string | undefined;
}

export interface LogsParams extends RangeParams {
  service?: string | undefined;
  failedOnly: boolean;
  page: number;
  pageSize: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as ApiError | null)?.error;
    throw new Error(message ?? `The server answered ${response.status} ${response.statusText}`);
  }
  return body as T;
}

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

export const api = {
  upload: (file: File) =>
    request<UploadResponse>(`/upload?${query({ filename: file.name })}`, {
      method: "POST",
      body: file,
      headers: { "content-type": "text/csv" },
    }),
  datasets: (signal?: AbortSignal) => request<DatasetList>("/datasets", { signal }),
  dataset: (id: string, signal?: AbortSignal) => request<DatasetDetail>(`/datasets?${query({ id })}`, { signal }),
  stats: (params: RangeParams, signal?: AbortSignal) => request<Stats>(`/stats?${query(params)}`, { signal }),
  logs: (params: LogsParams, signal?: AbortSignal) => request<LogsPage>(`/logs?${query(params)}`, { signal }),
};
