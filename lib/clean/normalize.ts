import { SLOT_MS } from "../time.js";
import type { RowFlag } from "./types.js";

const EPOCH_SECONDS = /^\d{10}$/;
// Date and time are required, and so is the zone: "Z" or "+hh:mm" / "-hh:mm".
const ISO_8601 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|([+-])(\d{2}):(\d{2}))$/;

export type TimestampResult =
  | { ok: true; date: Date; flag?: Extract<RowFlag, "ts_from_epoch" | "ts_from_offset"> }
  | { ok: false; reason: "invalid_timestamp" | "off_grid_timestamp" };

/**
 * Accepts the three formats found in the agent logs and returns a UTC Date.
 * These three all mean the same instant:
 *   2025-05-08T10:15:00Z        (most rows)
 *   2025-05-08T15:45:00+05:30   (agents writing local India time)
 *   1746699300                  (Unix epoch seconds)
 * A timestamp without a zone is rejected: we can't know which timezone it means.
 */
export function parseTimestamp(input: string): TimestampResult {
  let date: Date;
  let flag: "ts_from_epoch" | "ts_from_offset" | undefined;

  if (EPOCH_SECONDS.test(input)) {
    date = new Date(Number(input) * 1000);
    flag = "ts_from_epoch";
  } else {
    const match = ISO_8601.exec(input);
    if (!match) return { ok: false, reason: "invalid_timestamp" };

    const [, year, month, day, hour, minute, second, zone, sign, offsetH, offsetM] = match;
    const fields = [year, month, day, hour, minute, second].map(Number) as [number, number, number, number, number, number];
    const asUtc = new Date(Date.UTC(fields[0], fields[1] - 1, fields[2], fields[3], fields[4], fields[5]));

    // Date.UTC silently rolls invalid values over (Feb 30 -> Mar 2, 24:00 -> next day).
    // Reading the fields back tells us whether the input was a real calendar time.
    const roundTrip = [
      asUtc.getUTCFullYear(),
      asUtc.getUTCMonth() + 1,
      asUtc.getUTCDate(),
      asUtc.getUTCHours(),
      asUtc.getUTCMinutes(),
      asUtc.getUTCSeconds(),
    ];
    if (roundTrip.some((value, i) => value !== fields[i])) return { ok: false, reason: "invalid_timestamp" };

    if (zone === "Z") {
      date = asUtc;
    } else {
      // "+05:30" means local time is 5h30m ahead of UTC, so subtract it to get UTC.
      const offsetMinutes = (sign === "-" ? -1 : 1) * (Number(offsetH) * 60 + Number(offsetM));
      date = new Date(asUtc.getTime() - offsetMinutes * 60_000);
      flag = "ts_from_offset";
    }
  }

  // Checks run every 15 minutes, and de-duplication and outage detection rely on that grid.
  if (date.getTime() % SLOT_MS !== 0) return { ok: false, reason: "off_grid_timestamp" };

  return flag ? { ok: true, date, flag } : { ok: true, date };
}

/** A real HTTP status code (100-599), or null. Catches sentinel values like 999. */
export function parseStatus(input: string): number | null {
  if (!/^\d{3}$/.test(input)) return null;
  const code = Number(input);
  return code >= 100 && code <= 599 ? code : null;
}

export interface LatencyResult {
  ms: number | null;
  flag?: Extract<RowFlag, `latency_${string}`>;
}

/**
 * Converts latency to integer milliseconds. Unusable values become null instead of
 * rejecting the row: the status code is still valid evidence of up/down.
 */
export function parseLatency(value: string, unit: string): LatencyResult {
  if (value === "") return { ms: null, flag: "latency_missing" };
  if (/^-\d+(\.\d+)?$/.test(value)) return { ms: null, flag: "latency_negative" };
  if (!/^\d+(\.\d+)?$/.test(value)) return { ms: null, flag: "latency_invalid" };

  const amount = Number(value);
  switch (unit.toLowerCase()) {
    case "ms":
      return { ms: Math.round(amount) };
    case "s": // svc-search reports seconds, everyone else milliseconds
      return { ms: Math.round(amount * 1000), flag: "latency_from_seconds" };
    default:
      return { ms: null, flag: "latency_unknown_unit" };
  }
}
