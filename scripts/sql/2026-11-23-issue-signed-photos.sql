-- Photo of the signed paper slip (ใบเซ็น), one per slip, stored in the database.
-- Run on Neon BEFORE deploying this version (branch backup first, ask the owner). Safe to run twice.
create table if not exists issue_signed_photos (
  issue_id    uuid primary key references fuel_issues(id) on delete cascade,
  mime        text not null,
  data        bytea not null,
  uploaded_by uuid references users(id),
  created_at  timestamptz not null default now()
);
