import type { RejectReason, RowFlag } from "../lib/clean/types";

const numberFormat = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const shortDateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const monthFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

export const count = (value: number) => numberFormat.format(value);

/** Truncated, not rounded: 99.9996% must never display as "100%" or pass a 99.9 threshold by rounding. */
export function percent(value: number | null, digits = 3): string {
  if (value === null) return "–";
  if (value === 100) return "100%";
  const factor = 10 ** digits;
  return `${(Math.floor(value * factor) / factor).toFixed(digits)}%`;
}

export function duration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export const date = (iso: string) => dateFormat.format(new Date(iso));
export const shortDate = (iso: string) => shortDateFormat.format(new Date(iso));
export const time = (iso: string) => timeFormat.format(new Date(iso));
export const dateTime = (iso: string) => `${shortDate(iso)}, ${time(iso)}`;
export const month = (yyyyMm: string) => monthFormat.format(new Date(`${yyyyMm}-01T00:00:00Z`));

/** "a", "a and b", "a, b and c" */
export function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** First and last day of a dataset, as the YYYY-MM-DD values date inputs use. */
export const isoDay = (iso: string) => iso.slice(0, 10);

export const FLAG_LABELS: Record<RowFlag, string> = {
  ts_from_epoch: "Time was Unix epoch",
  ts_from_offset: "Time had a UTC offset",
  latency_from_seconds: "Latency was in seconds",
  latency_missing: "Latency missing",
  latency_negative: "Latency was negative",
  latency_invalid: "Latency not a number",
  latency_unknown_unit: "Unknown latency unit",
};

export const REJECT_LABELS: Record<RejectReason, string> = {
  wrong_column_count: "Wrong number of columns",
  missing_field: "A required field is empty",
  invalid_timestamp: "Timestamp can't be read",
  off_grid_timestamp: "Time isn't on the 15-minute grid",
  invalid_status_code: "Status isn't a real HTTP code (e.g. 999)",
  duplicate: "Duplicate of a row that was kept",
  conflicting_duplicate: "Duplicate with a different result",
};
