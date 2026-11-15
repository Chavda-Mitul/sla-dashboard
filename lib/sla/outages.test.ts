import { describe, expect, it } from "vitest";
import { SLOT_MS } from "../time.js";
import { detectOutages } from "./outages.js";
import type { Slot } from "./slots.js";

const T0 = Date.parse("2025-05-08T00:00:00Z");
const at = (index: number) => new Date(T0 + index * SLOT_MS);

/** One character per 15-minute check: "X" failed, "." passed, "_" no data. */
function slots(serviceId: string, pattern: string): Slot[] {
  return [...pattern].flatMap((char, i) =>
    char === "_" ? [] : [{ serviceId, checkedAt: at(i), failed: char === "X", reports: 1, disagreement: false }],
  );
}

describe("detectOutages (minFailures 3, maxPassingGap 2)", () => {
  it("joins failures separated by passing checks into one outage", () => {
    const { outages, transientFailures } = detectOutages(slots("svc-a", "..XX.X..."));
    expect(outages).toEqual([
      { serviceId: "svc-a", start: at(2), end: at(6), failedChecks: 3, observedChecks: 4 },
    ]);
    expect(transientFailures).toEqual([]);
  });

  it("allows exactly two passing checks between failures", () => {
    const { outages } = detectOutages(slots("svc-a", "X..X..X"));
    expect(outages).toMatchObject([{ start: at(0), end: at(7), failedChecks: 3, observedChecks: 7 }]);
  });

  it("splits runs separated by three or more passing checks", () => {
    const { outages, transientFailures } = detectOutages(slots("svc-a", "XX...XXX"));
    expect(outages).toMatchObject([{ start: at(5), end: at(8), failedChecks: 3 }]);
    expect(transientFailures.map((s) => s.checkedAt)).toEqual([at(0), at(1)]);
  });

  it("reports fewer than three failures as transient, not an outage", () => {
    const { outages, transientFailures } = detectOutages(slots("svc-a", "...X.X...."));
    expect(outages).toEqual([]);
    expect(transientFailures).toHaveLength(2);
  });

  it("counts check times with no data towards the gap, like passing checks", () => {
    // Between the first two failures: one pass and two missing check times = gap of 3.
    expect(detectOutages(slots("svc-a", "X.__X.X")).outages).toEqual([]);
    expect(detectOutages(slots("svc-a", "X..X.X")).outages).toHaveLength(1);
  });

  it("only counts observed checks inside the outage window", () => {
    const { outages } = detectOutages(slots("svc-a", "XX_X"));
    expect(outages).toMatchObject([{ failedChecks: 3, observedChecks: 3, end: at(4) }]);
  });

  it("never merges failures across services", () => {
    const { outages } = detectOutages([...slots("svc-a", "XX"), ...slots("svc-b", "X")]);
    expect(outages).toEqual([]);
  });

  it("accepts custom rules", () => {
    expect(detectOutages(slots("svc-a", "XX"), { minFailures: 2, maxPassingGap: 0 }).outages).toHaveLength(1);
  });
});
