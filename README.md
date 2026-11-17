# SLA Monitoring Dashboard

Upload a CSV of service health checks. A serverless function cleans it and stores it in Postgres.
One page then shows a collapsible stats section (whether each service met its 99.9% SLA, and the
outages behind that answer) with the underlying check logs below it.

## Live URL

**https://sla-dashboard-blue.vercel.app**

Last verified live on 17 Nov 2026:
- all 5 sample files uploaded through the API (and are there to browse)
- the stats and logs match the local test results
- the UI was checked in a browser: stats collapse and expand, the logs sit below them, and the
  one-day and date-range filters drive both

It runs on free plans with no expiry. If it's ever down, redeploy with the steps under
[Run and deploy](#run-and-deploy).

## Architecture

```
Browser ── Vite + React + MUI, static files on Vercel
   │  POST /api/upload  (raw CSV body)
   │  GET  /api/datasets, /api/stats, /api/logs
   ▼
Vercel Functions ── Node, one file per route in api/ (runs on AWS Lambda); stateless
   │  parse → validate → clean (lib/clean), SLA maths (lib/sla), SQL (lib/store.ts)
   ▼
Neon Postgres ── datasets, checks, rejected_rows (db/schema.sql)
```

**Upload:** the browser sends the file's bytes to `POST /api/upload`. The function:
1. hashes the file; if the same bytes were uploaded before, it returns that dataset;
2. runs `cleanChecks()`, a pure function that parses, validates, normalizes and de-duplicates;
3. stores the dataset, all clean checks and all rejected rows in **one transaction**;
4. returns the data-quality report.

Nothing is kept in memory between requests.

**Dashboard:** `GET /api/stats` loads the stored checks for the selected dates and computes the
stats with the same `lib/sla` code that the tests check against the incident log. `GET /api/logs`
pages through the stored checks in SQL.

### Why these pieces

| Piece | Why | Trade-off |
|---|---|---|
| **Vercel Functions** | A real serverless function (AWS Lambda underneath), free with no credit card. Served from the same origin as the UI, so no CORS. One command deploys UI and functions together. | Request bodies are capped at 4.5 MB; the largest sample file is 1.2 MB. Bigger files would need direct-to-storage upload (see below). |
| **Neon Postgres** | Free serverless Postgres that scales to zero. The questions are relational: a time range, filters, pagination, one transaction per upload. | Cold start of a few hundred ms after idle. Firestore was ruled out: its free tier allows 20k writes a day, and one 30-day file is 15.5k rows. |
| **Pure `lib/` code** | Cleaning and SLA logic have no I/O, so the function, the tests and `npm run report` run the same code. | — |
| **Stats computed per request** | A dataset is at most ~15k rows, so recomputing is fast, can never be stale, and any date range works. | Would need precomputed tables at much larger sizes. |
| **Raw CSV body, not multipart** | Simple to hash for duplicate detection; no multipart parser needed. | — |

| Path | What's there |
|---|---|
| `api/` | The four functions: `upload`, `datasets`, `stats`, `logs` |
| `lib/clean/` | `parseCsv` (is it a CSV, which columns), `normalize` (one field at a time), `cleanChecks` (rows → checks + rejected + report) |
| `lib/sla/policy.ts` | **Every judgement call that affects SLA credits, in one file** |
| `lib/sla/` | `slots` (merge agents per check), `outages` (outage vs transient), `stats` (availability, monthly SLA, latency) |
| `lib/store.ts`, `db/schema.sql` | All SQL, parameterized; bulk inserts with `unnest()` |
| `src/` | The React UI |
| `data/` | The 5 sample files and the incident log, used as test fixtures |

## Data findings

All 5 sample files have the same problems. Counts are per file, smallest (9-day) to largest
(30-day); `npm run report` prints them.

| Issue | Per file | How it's handled |
|---|---|---|
| **Three timestamp formats:** ISO `Z`, Unix epoch seconds (`1748729700`), ISO with `+05:30` (India time) | epoch 70–233, `+05:30` 32–109 | All converted to UTC. Ignoring the `+05:30` shifts a check by 5½ hours and creates fake gaps and duplicates. A timestamp with no zone would be rejected as ambiguous (none in the data). |
| **Mixed latency units:** svc-search reports seconds (`0.486`), the rest milliseconds | every svc-search row | Converted to integer ms |
| **A second agent re-reports ~7% of checks**, usually with a slightly different latency | 345–1,152 checks | Both reports kept; merged into one up/down result per check for the SLA |
| **Same-agent duplicates**, some only visible after timestamp conversion (the same check written as epoch and as ISO), some where one copy has an empty latency | 7–25 rows | One kept, preferring the copy with a latency reading |
| **Status `999`**, not an HTTP code | 1 | Row rejected; it counts as neither up nor down. In the 14-day file, agent-2 reported `200` for the same check. |
| **Empty latency** | 56–186 | Row kept (the status is still valid evidence), latency stored as null |
| **Negative latency** (`-286`) | 1 | Row kept, latency stored as null |
| **Rows not in time order** | all | Sorted |

Checked and fine:
- once timestamps are converted, every service has a check every 15 minutes for the whole span (the only gap is the check whose single report was the `999`);
- every timestamp is on the 15-minute grid;
- `service_id` and `service_name` always match;
- there is one region.

Every dropped row is stored with its line number and reason, and shown under Data quality.

**Outages vs noise.** Besides the outages in `dataset_incident_log.json`, every service has
scattered single 5xx errors; svc-reports has 15–75 per file. With one check every 15 minutes,
99.9% a month allows only about 3 failed checks. Counting each failed check as 15 minutes of
downtime would make **every service breach in every file**.

The detector therefore counts an outage as **at least 3 failed checks, with at most 2 passing
checks between failures** (a flapping service is still down). Against the incident log:
- it finds all 9 logged outages, each as exactly one outage, with start and end within 3 checks;
- it also flags 3 short bursts that aren't in the log (12d svc-reports day 2, 21d svc-reports
  day 2, 9d svc-search day 8).

Those 3 bursts look the same as the shortest logged outage (3 failures within 6 checks), so no
rule catches that one without also catching them. Stricter settings miss it or split a long
outage in two. `test/sampleFiles.test.ts` asserts all of this.

## Assumptions

| Where the spec was open | Choice | Why |
|---|---|---|
| What counts as downtime | Sustained outages only (rule above). Single failures are shown as transient errors. | Real SLAs measure sustained unavailability; counting every blip turns every service red and the number stops meaning anything. |
| How long a failed check lasts | Until the next check: an outage runs from its first failed check to 15 minutes after its last | Checks are 15 minutes apart; that's the resolution the data has. |
| What is a failure | 5xx only. A 4xx is the caller's problem, not provider downtime. | Cloud SLAs count server errors. No 4xx appears in the samples. |
| Agents disagree about a check | The failure wins | Someone could have hit that failure; hiding an outage is worse than over-crediting. |
| A month with only partial data | Availability = 1 − outage minutes ÷ **observed** minutes, per UTC calendar month; an outage crossing midnight on the last day is split between months | Unobserved time isn't assumed to be up. The 30-day file spans April and May, so it's billed as two months. |
| Several uploads | Each upload is its own dataset; the same bytes again return the saved one (sha256) | The sample files cover overlapping dates with different data, so merging them would mix contradicting reports. |
| Date filter | Whole UTC days, inclusive. One filter drives both stats and logs. Outages crossing the filter edge are cut at the edge. | The numbers on the page always describe the same slice. |
| Time zone | Everything is UTC and labelled as such | The source mixes UTC, epoch and +05:30. |

**The dashboard page**, top to bottom, all on one screen:
1. **Filters:** the dataset, then all dates, one day or a date range (UTC). One filter drives
   both sections below.
2. **Stats, collapsible.** "Hide stats" folds the section down to a one-line verdict, so the logs
   move up to the top of the page. Inside: the verdict and headline numbers, then the detail as
   five views in tabs, so the section stays short and the logs stay within reach.
3. **Check logs:** every stored report for the selected dates, filterable by service and
   failed-only, paged in SQL.

**Which stats, and why.** Two people use this page:
- Billing needs to know who is owed a credit. The verdict says it in words ("svc-auth and
  svc-reports breached the 99.9% SLA in April 2025"). Under it are the overall availability,
  downtime, number of breaches, outages and transient errors. **SLA & billing** shows
  availability, downtime, downtime allowed and the result for each service and month.
- On call needs to know what happened, when, and why:
  - **Overview:** each service's status, worst first, and a daily health grid of downtime per
    service per UTC day.
  - **Outages:** a timeline placing each outage on its service's lane at its real time, and a
    table of outages with their duration and the error codes seen.
  - **Errors & latency:** server errors by status code, latency over time with outages marked,
    and a service health table showing what is wearing down before it becomes a breach (raw
    success rate, transient errors, latency p50/p95/p99, how often the agents disagreed).
  - Selecting a service, a day or an outage sets the filters and scrolls down to those checks in
    the logs.

**Data quality** shows what the cleaner kept, fixed and dropped. The credit is decided by the data
alone, so the page shows how that data was treated.

## Run and deploy

Locally (needs Node 22+ and Docker):

```bash
npm install
docker run -d --name sla-dashboard-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sla -p 5442:5432 postgres:17-alpine
docker exec sla-dashboard-pg psql -U postgres -c "create database sla_test"
cp .env.example .env.local
npm run db:migrate
npm run dev       # UI and API together on http://localhost:5173 (vite.config.ts serves api/ like Vercel does)
npm test          # 124 tests; the API tests run against Postgres when TEST_DATABASE_URL is set
npm run report    # quality report and outages for data/*.csv
```

Deploy to Vercel + Neon, from the CLI (no CI, as the brief asks):

```bash
npx vercel login
npx vercel link --yes --project sla-dashboard
# Free Neon database in the functions' region; sets DATABASE_URL on the project.
# The first time, it asks you to accept Neon's terms in the browser, then run it again.
npx vercel integration add neon --billing-plan free_v3 --meta region=iad1 --no-env-pull
npx vercel env pull .env.production.local --environment=production
npx tsx --env-file=.env.production.local scripts/migrate.ts
npx vercel deploy --prod
```

Notes:
- The free plans stay up without a card. Neon scales to zero when idle, so the first request after
  a quiet period takes a moment longer.
- If your network's DNS can't resolve the Neon host (`ENOTFOUND` during the migration), paste
  `db/schema.sql` into the SQL editor in Neon's console instead.
- To upload with curl, add `-H "Expect:"`. For bodies over 1 MB curl sends `Expect: 100-continue`,
  which doesn't get a reply here. Browsers don't send it.

  ```bash
  curl -H "Expect:" -H "content-type: text/csv" --data-binary @data/monitoring_checks_30d_seed404.csv \
    "https://sla-dashboard-blue.vercel.app/api/upload?filename=monitoring_checks_30d_seed404.csv"
  ```

**How it's tested.**
- Unit tests cover each parser and rule.
- Fixture tests run all 5 sample files. Their expected counts come from a separate Python
  profiling script, so the two implementations check each other, and all 9 logged outages are
  asserted.
- API tests run the real handlers against Postgres: upload, duplicate upload, bad files, stats
  round trip, log filters.
- The UI was checked in a browser at desktop and phone widths.

## What I'd do with more time

- **Larger files:** upload straight to object storage with a signed URL, and have the storage
  event trigger the cleaning function with streaming parsing. This removes the 4.5 MB limit.
- **Precomputed slots and outages** stored at upload time, so stats become SQL queries and scale
  past ~100k rows per dataset.
- **Versioned, per-customer SLA policy** (target, outage rule) stored with each result, so a
  credit decision can be reproduced later even if the rules change.
- **Smarter outage detection:** use each service's normal error rate (svc-reports is always
  flaky) and multi-region agreement before declaring a failure.
- **Log drill-down to the outage window** instead of the whole day, plus browser end-to-end tests
  (Playwright) for the flows that were checked by hand.
