import { readdirSync, readFileSync } from "node:fs";

/** The sample files from the assignment, plus the incident log that came with them. */
const DATA_DIR = new URL("../data/", import.meta.url);

export const DATA_FILES = readdirSync(DATA_DIR)
  .filter((name) => name.endsWith(".csv"))
  .sort();

export function readDataFile(name: string): string {
  return readFileSync(new URL(name, DATA_DIR), "utf8");
}

export interface IncidentLogEntry {
  days: number;
  start: string; // YYYY-MM-DD
  incidents: Record<string, string>; // "svc-reports day 5": "check-points 64-69 (~16:00-17:15 UTC)"
}

export const INCIDENT_LOG = JSON.parse(readDataFile("dataset_incident_log.json")) as Record<string, IncidentLogEntry>;

/** A window of check-points: `day` counts from the file's start date, `from`/`to` are 0-95 within that day. */
export interface CheckpointWindow {
  serviceId: string;
  day: number;
  from: number;
  to: number;
}

export function loggedIncidents(file: string): CheckpointWindow[] {
  return Object.entries(INCIDENT_LOG[file]!.incidents).map(([where, when]) => {
    const [, serviceId, day] = /^(\S+) day (\d+)$/.exec(where)!;
    const [, from, to] = /^check-points (\d+)-(\d+)/.exec(when)!;
    return { serviceId: serviceId!, day: Number(day), from: Number(from), to: Number(to) };
  });
}
