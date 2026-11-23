-- Stage 2: slips and purchases that arrive from the BookCare phone app (API contract v1).
-- Run on Neon BEFORE deploying this version: make a backup branch first, ask the owner. Safe to run twice.
begin;

alter table fuel_issues
  add column if not exists source text not null default 'paper',
  add column if not exists external_ref uuid,
  add column if not exists request_hash text,
  add column if not exists review_status text not null default 'checked',
  add column if not exists reviewed_by uuid references users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists recorded_at timestamptz,
  add column if not exists received_at timestamptz,
  add column if not exists driver_bookcare_id text,
  add column if not exists signature_ref text,
  add column if not exists unsigned_reason text,
  add column if not exists flags jsonb not null default '[]'::jsonb,
  add column if not exists confirmed_warnings jsonb not null default '[]'::jsonb,
  add column if not exists edited_after_sign boolean not null default false;
create unique index if not exists fuel_issues_external_ref_unique on fuel_issues(external_ref);
create index if not exists fuel_issues_review_idx on fuel_issues(review_status) where review_status <> 'checked';

alter table fuel_purchases
  add column if not exists source text not null default 'office',
  add column if not exists external_ref uuid,
  add column if not exists status text not null default 'confirmed',
  add column if not exists confirmed_by uuid references users(id),
  add column if not exists confirmed_at timestamptz,
  add column if not exists recorded_at timestamptz,
  add column if not exists driver_name text,
  add column if not exists driver_bookcare_id text,
  add column if not exists request_hash text,
  add column if not exists flags jsonb not null default '[]'::jsonb;
create unique index if not exists fuel_purchases_external_ref_unique on fuel_purchases(external_ref);

alter table machines add column if not exists pending_review boolean not null default false;

create table if not exists fuel_issue_line_photos (
  line_id    uuid primary key references fuel_issue_lines(id) on delete cascade,
  mime       text not null,
  sha256     text not null,
  taken_at   timestamptz,
  data       bytea not null,
  created_at timestamptz not null default now()
);

-- the "BookCare" user that owns recorded_by of phone slips: inactive, no usable password, cannot log in
insert into users (name, email, password_hash, role, active)
select 'BookCare (มือถือ พขร.)', 'bookcare@system.invalid', '!', 'system_admin', false
where not exists (select 1 from users where email = 'bookcare@system.invalid');

commit;
