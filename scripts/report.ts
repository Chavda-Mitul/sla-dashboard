/**
 * Prints the data-quality report and detected outages for CSV files, using the same code the
 * upload function runs. Handy for the README and for checking the dashboard's numbers.
 *
 *   npm run report                      # every CSV in data/
 *   npm run report -- path/to/file.csv  # specific files
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { cleanChecks } from "../lib/clean/cleanChecks.js";
import { detectOutages } from "../lib/sla/outages.js";
import { resolveSlots } from "../lib/sla/slots.js";

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync("data").filter((name) => name.endsWith(".csv")).sort().map((name) => join("data", name));

const minutes = (ms: number) => ms / 60_000;
const hhmm = (date: Date) => date.toISOString().slice(0, 16).replace("T", " ");

for (const file of files) {
  const { checks, report } = cleanChecks(readFileSync(file, "utf8"));
  const { outages, transientFailures } = detectOutages(resolveSlots(checks));

  console.log(`\n=== ${basename(file)}  (${report.firstCheckAt} -> ${report.lastCheckAt})`);
  console.log(`rows ${report.totalRows}, accepted ${report.acceptedRows}, rejected ${report.rejectedRows}`, report.rejectedByReason);
  console.log("fixed/flagged:", report.flagged);
  console.log(
    `slots: expected ${report.expectedSlots}, covered ${report.coveredSlots}, missing ${report.missingSlots}, ` +
      `reported by 2+ agents ${report.multiAgentSlots}`,
  );

  console.log(`outages (${outages.length}):`);
  for (const o of outages) {
    console.log(
      `  ${o.serviceId.padEnd(13)} ${hhmm(o.start)} -> ${hhmm(o.end)} UTC  ` +
        `${minutes(o.end.getTime() - o.start.getTime())} min, ${o.failedChecks}/${o.observedChecks} checks failed`,
    );
  }

  const transientByService: Record<string, number> = {};
  for (const slot of transientFailures) transientByService[slot.serviceId] = (transientByService[slot.serviceId] ?? 0) + 1;
  console.log("transient failures (not counted as downtime):", transientByService);
}
