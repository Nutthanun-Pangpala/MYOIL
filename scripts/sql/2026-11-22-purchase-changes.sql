-- OBS-18: purchases can be cancelled (never deleted) and have a history.
-- Run on Neon BEFORE deploying this version (branch backup first, ask the owner). Safe to run twice.
alter table fuel_purchases add column if not exists cancelled_at timestamptz;
alter table fuel_purchases add column if not exists cancel_reason text;
alter table fuel_purchases add column if not exists cancelled_by uuid references users(id);

create table if not exists purchase_audit (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references fuel_purchases(id) on delete cascade,
  user_id     uuid references users(id),
  action      text not null,
  changes     jsonb,
  at          timestamptz not null default now()
);
create index if not exists purchase_audit_purchase_idx on purchase_audit (purchase_id);
