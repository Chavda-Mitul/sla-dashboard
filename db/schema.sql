-- Applied by `npm run db:migrate`. Safe to re-run.

-- One row per uploaded file. Re-uploading the same bytes is detected by the hash.
create table if not exists datasets (
  id             uuid primary key,
  filename       text not null,
  file_sha256    text not null unique,
  uploaded_at    timestamptz not null default now(),
  first_check_at timestamptz,
  last_check_at  timestamptz,
  report         jsonb not null           -- the data-quality report (QualityReport in lib/clean/types.ts)
);

-- Cleaned checks. Every agent's report is its own row; the SLA code merges them per slot.
create table if not exists checks (
  dataset_id   uuid not null references datasets (id) on delete cascade,
  service_id   text not null,
  service_name text not null,
  checked_at   timestamptz not null,       -- UTC, on the 15-minute grid
  agent        text not null,
  region       text not null,
  status_code  smallint not null,
  latency_ms   integer,                    -- null when the source value was missing or invalid
  source_line  integer not null,           -- line in the uploaded file, for tracing a row back
  flags        text[] not null default '{}', -- what the cleaner changed or noticed (RowFlag)
  primary key (dataset_id, service_id, checked_at, agent)
);

-- The logs view and stats filter by dataset + time range.
create index if not exists checks_dataset_time on checks (dataset_id, checked_at);

-- Rows the cleaner dropped, with the reason, so nothing disappears silently.
create table if not exists rejected_rows (
  dataset_id  uuid not null references datasets (id) on delete cascade,
  source_line integer not null,
  reason      text not null,
  raw         text not null,
  primary key (dataset_id, source_line)
);
