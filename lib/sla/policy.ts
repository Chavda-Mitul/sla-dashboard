/**
 * The judgement calls that decide whether a customer gets an SLA credit live in this one file,
 * so they can be reviewed and changed in one place. The reasoning is in the README (Assumptions).
 */

/** A 5xx is the provider failing. A 4xx is a client-side problem, so it doesn't count as downtime. */
export function isFailure(statusCode: number): boolean {
  return statusCode >= 500;
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
