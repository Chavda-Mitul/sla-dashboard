import { z, ZodError } from "zod";
import { CsvFormatError } from "./clean/parseCsv.js";
import type { TimeRange } from "./store.js";

/** An error with an HTTP status the client should see (bad input, not found, too large). */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Runs a handler and turns thrown errors into JSON `{ error }` responses. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    if (err instanceof CsvFormatError) return json({ error: err.message }, 400);
    if (err instanceof ZodError) {
      const message = err.issues.map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`).join("; ");
      return json({ error: message }, 400);
    }
    console.error(err);
    return json({ error: "Internal server error" }, 500);
  }
}

/** Query string as a plain object, dropping empty values (`?from=` means "not set"). */
export function queryOf(request: Request): Record<string, string> {
  const entries = [...new URL(request.url).searchParams].filter(([, value]) => value !== "");
  return Object.fromEntries(entries);
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value); // rejects 2025-02-30
  }, "not a real date");

/** `from` / `to` are whole UTC days, both inclusive; a single date is from = to. */
export const rangeQuery = z
  .object({
    datasetId: z.uuid(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "from must not be after to", path: ["from"] });

export const logsQuery = z
  .object({
    datasetId: z.uuid(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    service: z.string().max(100).optional(),
    failedOnly: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
    page: z.coerce.number().int().min(0).default(0),
    pageSize: z.coerce.number().int().min(1).max(500).default(100),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "from must not be after to", path: ["from"] });

const DAY_MS = 24 * 60 * 60 * 1000;

/** Inclusive dates -> [start of `from`, start of the day after `to`). */
export function toTimeRange(from?: string, to?: string): TimeRange {
  return {
    start: from ? new Date(`${from}T00:00:00Z`) : null,
    end: to ? new Date(Date.parse(`${to}T00:00:00Z`) + DAY_MS) : null,
  };
}
