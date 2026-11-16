import type { Check } from "../clean/types.js";
import { isFailure } from "./policy.js";

/** The merged verdict for one service at one 15-minute check time, across all agents. */
export interface Slot {
  serviceId: string;
  checkedAt: Date;
  failed: boolean;
  /** How many agents reported this check. */
  reports: number;
  /** One agent saw a failure while another saw the service up. */
  disagreement: boolean;
}

/**
 * Merges the reports of all agents into one verdict per (service, check time).
 * If any agent saw a failure, the slot counts as failed: a customer could have hit that
 * failure, and wrongly hiding an outage is worse than over-counting one.
 * Returned sorted by service, then time.
 */
export function resolveSlots(checks: Pick<Check, "serviceId" | "checkedAt" | "statusCode">[]): Slot[] {
  const tallies = new Map<string, { serviceId: string; checkedAt: Date; reports: number; failures: number }>();

  for (const check of checks) {
    const key = `${check.serviceId}|${check.checkedAt.getTime()}`;
    const tally = tallies.get(key) ?? { serviceId: check.serviceId, checkedAt: check.checkedAt, reports: 0, failures: 0 };
    tally.reports += 1;
    if (isFailure(check.statusCode)) tally.failures += 1;
    tallies.set(key, tally);
  }

  return [...tallies.values()]
    .map(({ serviceId, checkedAt, reports, failures }) => ({
      serviceId,
      checkedAt,
      failed: failures > 0,
      reports,
      disagreement: failures > 0 && failures < reports,
    }))
    .sort((a, b) =>
      a.serviceId === b.serviceId ? a.checkedAt.getTime() - b.checkedAt.getTime() : a.serviceId < b.serviceId ? -1 : 1,
    );
}
