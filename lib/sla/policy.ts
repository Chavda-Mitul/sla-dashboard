/**
 * The judgement calls that decide whether a customer gets an SLA credit live in this one file,
 * so they can be reviewed and changed in one place. The reasoning is in the README (Assumptions).
 */

/** The monthly availability promised in the SLA. Below this, the customer is owed a credit. */
export const SLA_TARGET_PCT = 99.9;

/**
 * A 5xx is the provider failing. A 4xx is a client-side problem, so it doesn't count as downtime.
 * Exported as a number too, so the logs query filters with the same rule.
 */
export const FAILURE_MIN_STATUS = 500;

export function isFailure(statusCode: number): boolean {
  return statusCode >= FAILURE_MIN_STATUS;
}

/**
 * An outage is a run of at least `minFailures` failed checks, where failures may be separated
 * by up to `maxPassingGap` checks that passed (a flapping service is still down).
 * Fewer failures than that are reported as transient errors and don't count against the SLA.
 *
 * Tuned against dataset_incident_log.json: these values find all 9 logged outages. Stricter
 * values either miss the shortest one (3 failures in 6 checks) or split a long one in two.
 */
export const OUTAGE_RULES = {
  minFailures: 3,
  maxPassingGap: 2,
} as const;
