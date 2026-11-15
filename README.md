# SLA Monitoring Dashboard

Upload a CSV of service health checks, have a serverless function clean it, store the result in
Postgres, and look at SLA stats and the underlying check logs on one page.

> Status: work in progress. Data cleaning and outage detection are done and tested;
> the database, API, dashboard and deployment are next.

## Live URL

_TBD after deployment (with last-verified date)._

## Architecture

_TBD._ Planned: Vite/React UI on Vercel → Vercel Function (Node, runs on AWS Lambda) that parses,
validates and cleans the upload → Neon Postgres → read endpoints for stats and logs.

The cleaning and SLA logic lives in `lib/` as pure functions (no I/O), so the serverless function
and the tests run exactly the same code:

| File | What it does |
|---|---|
| `lib/clean/parseCsv.ts` | Reads the CSV, checks it's text, finds the required columns |
| `lib/clean/normalize.ts` | Parses one field at a time: timestamps → UTC, latency → ms, status codes |
| `lib/clean/cleanChecks.ts` | Runs the above over every row, removes duplicates, builds the data-quality report |
| `lib/sla/policy.ts` | **Every judgement call that affects SLA credits, in one file** |
| `lib/sla/slots.ts` | Merges all agents' reports into one up/down verdict per service per 15-min check |
| `lib/sla/outages.ts` | Groups failed checks into outages vs transient errors |

## Data findings

_Draft, from profiling all 5 sample files (`npm run report` prints these numbers)._

| Issue | Per file (9d → 30d) | Handling |
|---|---|---|
| Three timestamp formats: ISO `Z`, Unix epoch seconds, ISO with `+05:30` | epoch 70–233, `+05:30` 32–109 | All converted to UTC. Zone-less timestamps would be rejected as ambiguous. |
| svc-search reports latency in seconds, the others in ms | every svc-search row | Converted to integer ms |
| A second agent re-reports ~7% of checks | 345–1152 slots | Both reports kept as separate rows; merged into one verdict per slot for SLA |
| Duplicate rows from the same agent, some only visible after timestamp conversion (epoch vs ISO), some where one copy has an empty latency | 7–25 | Kept one, preferring the copy with a latency reading |
| Status code `999` | 1 | Rejected (not an HTTP code); in the 14d file another agent covered the same check |
| Empty latency | 56–186 | Row kept (status still valid), latency stored as null |
| Negative latency | 1 | Row kept, latency stored as null |
| Rows not in time order | all | Sorted |

Checked and fine: once timestamps are converted, every service has a check every 15 minutes for the
whole span (the only gaps are slots whose single report was the `999`); every timestamp is on the
15-minute grid; `service_id` and `service_name` always match; there is one region.

**Outages vs noise.** Besides the outages in `dataset_incident_log.json`, every service has scattered
single 5xx errors (svc-reports especially: 15–75 per file). With one check every 15 minutes, counting
each failed check as 15 minutes of downtime would make every service breach 99.9% in every file. The
detector (`lib/sla/policy.ts`) counts a run of at least 3 failed checks, with at most 2 passing checks
between failures, as an outage. Against the incident log it finds all 9 logged outages (boundaries
within 3 checks), plus 3 short bursts that aren't in the log but look the same as the shortest logged
outage (3 failures within 6 checks). Stricter rules miss that logged outage or split a long one in two.

## Assumptions

_TBD._ Decided so far:
- Downtime = sustained outages only; single failures are shown as transient errors.
- Only 5xx counts as a failure; a 4xx is a client-side problem.
- If agents disagree about a check, the failure wins (never hide an outage).
- All times are UTC.
- Each upload is its own dataset; re-uploading the same file is detected by its hash.

## Run locally

```bash
npm install
npm test          # unit tests + checks against the 5 sample files and the incident log
npm run report    # data-quality report and detected outages for data/*.csv
```

## What I'd do with more time

_TBD._
