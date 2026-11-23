-- Route of the fuel truck (stage 2, 23 Nov 2026): the store admin plans each day's stops; the phone fills or skips them.
-- Run on Neon BEFORE deploying this version: make a backup branch first, ask the owner. Safe to run twice.
-- Run after 2026-11-24-mobile-issues.sql (it needs fuel_issues' stage-2 columns).
begin;

alter table fuel_issues add column if not exists route_stop_id uuid;

create table if not exists fuel_routes (
  id uuid primary key default gen_random_uuid(),
  route_date date not null unique,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fuel_route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references fuel_routes(id) on delete cascade,
  position integer not null,
  project_id uuid not null references projects(id),
  note text,
  issue_id uuid references fuel_issues(id) on delete set null,
  skip_ref uuid unique,
  skip_reason text,
  skipped_at timestamptz,
  skipped_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fuel_route_stops_issue_unique unique (issue_id)
);
create index if not exists fuel_route_stops_route_idx on fuel_route_stops(route_id);

commit;
