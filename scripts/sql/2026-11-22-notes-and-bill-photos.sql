-- ledger "หมายเหตุ" per day + purchase bill photos (kept in the database).
-- Run on Neon BEFORE deploying this version (branch backup first). Safe to run twice.
create table if not exists ledger_notes (
  note_date  date primary key,
  note       text not null,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);

create table if not exists purchase_bill_photos (
  purchase_id uuid primary key references fuel_purchases(id) on delete cascade,
  mime        text not null,
  data        bytea not null,
  created_at  timestamptz not null default now()
);
