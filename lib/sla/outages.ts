import { SLOT_MS } from "../time.js";
import { OUTAGE_RULES } from "./policy.js";
import type { Slot } from "./slots.js";

export interface Outage {
  serviceId: string;
  /** Time of the first failed check. */
  start: Date;
  /** 15 minutes after the last failed check: each check speaks for the interval until the next one. */
  end: Date;
  failedChecks: number;
  /** Checks with data inside [start, end), passed or failed. */
  observedChecks: number;
}

export interface OutageResult {
  outages: Outage[];
  /** Failed checks that are not part of any outage: real errors, but too brief to count against the SLA. */
  transientFailures: Slot[];
}

export interface OutageRules {
  minFailures: number;
  maxPassingGap: number;
}

/**
 * Groups each service's failed checks into runs. A run continues while the gap between two
 * failures is at most `maxPassingGap` check times; those check times passed, or have no data.
 * Runs with at least `minFailures` failures are outages; shorter runs are transient failures.
 */
export function detectOutages(slots: Slot[], rules: OutageRules = OUTAGE_RULES): OutageResult {
  const outages: Outage[] = [];
  const transientFailures: Slot[] = [];

  for (const serviceSlots of groupByService(slots)) {
    let run: Slot[] = [];
    const closeRun = () => {
      if (run.length >= rules.minFailures) outages.push(toOutage(run, serviceSlots));
      else transientFailures.push(...run);
      run = [];
    };

    for (const failure of serviceSlots.filter((slot) => slot.failed)) {
      const previous = run.at(-1);
      if (previous) {
        const checkTimesBetween = (failure.checkedAt.getTime() - previous.checkedAt.getTime()) / SLOT_MS - 1;
        if (checkTimesBetween > rules.maxPassingGap) closeRun();
      }
      run.push(failure);
    }
    closeRun();
  }

  outages.sort((a, b) => a.start.getTime() - b.start.getTime());
  transientFailures.sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  return { outages, transientFailures };
}

function toOutage(run: Slot[], serviceSlots: Slot[]): Outage {
  const first = run[0]!;
  const start = first.checkedAt;
  const end = new Date(run.at(-1)!.checkedAt.getTime() + SLOT_MS);
  return {
    serviceId: first.serviceId,
    start,
    end,
    failedChecks: run.length,
    observedChecks: serviceSlots.filter(
      (slot) => slot.checkedAt.getTime() >= start.getTime() && slot.checkedAt.getTime() < end.getTime(),
    ).length,
  };
}

/** One time-sorted array of slots per service. */
function groupByService(slots: Slot[]): Slot[][] {
  const byService = new Map<string, Slot[]>();
  for (const slot of slots) {
    const list = byService.get(slot.serviceId) ?? [];
    list.push(slot);
    byService.set(slot.serviceId, list);
  }
  return [...byService.values()].map((list) => list.sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime()));
}
