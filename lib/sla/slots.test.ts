import { describe, expect, it } from "vitest";
import type { Check } from "../clean/types.js";
import { resolveSlots } from "./slots.js";

function check(serviceId: string, time: string, statusCode: number, agent = "agent-1"): Check {
  return {
    serviceId,
    serviceName: `${serviceId}-api`,
    checkedAt: new Date(time),
    statusCode,
    latencyMs: 100,
    agent,
    region: "ap-south-1",
    sourceLine: 2,
    flags: [],
  };
}

describe("resolveSlots", () => {
  it("merges agents into one verdict per service and time", () => {
    const slots = resolveSlots([
      check("svc-a", "2025-05-08T00:00:00Z", 200, "agent-1"),
      check("svc-a", "2025-05-08T00:00:00Z", 200, "agent-2"),
    ]);
    expect(slots).toEqual([
      { serviceId: "svc-a", checkedAt: new Date("2025-05-08T00:00:00Z"), failed: false, reports: 2, disagreement: false },
    ]);
  });

  it("counts the slot as failed if any agent saw a failure, and marks the disagreement", () => {
    const [slot] = resolveSlots([
      check("svc-a", "2025-05-08T00:00:00Z", 200, "agent-1"),
      check("svc-a", "2025-05-08T00:00:00Z", 503, "agent-2"),
    ]);
    expect(slot).toMatchObject({ failed: true, disagreement: true });
  });

  it("treats only 5xx as failures (4xx is a client-side problem)", () => {
    const slots = resolveSlots([
      check("svc-a", "2025-05-08T00:00:00Z", 404),
      check("svc-a", "2025-05-08T00:15:00Z", 500),
    ]);
    expect(slots.map((s) => s.failed)).toEqual([false, true]);
  });

  it("sorts by service, then time", () => {
    const slots = resolveSlots([
      check("svc-b", "2025-05-08T00:00:00Z", 200),
      check("svc-a", "2025-05-08T00:15:00Z", 200),
      check("svc-a", "2025-05-08T00:00:00Z", 200),
    ]);
    expect(slots.map((s) => `${s.serviceId} ${s.checkedAt.toISOString().slice(11, 16)}`)).toEqual([
      "svc-a 00:00",
      "svc-a 00:15",
      "svc-b 00:00",
    ]);
  });
});
