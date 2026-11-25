-- 25 Nov 2026 (owner, brief section 14 B1-B10): price by purchase bill, oldest fuel first.
-- Run on Neon BEFORE deploying this version (backup branch first). Safe to run twice.
alter table fuel_purchases add column if not exists purchase_time text;
alter table app_settings add column if not exists opening_price numeric(8,2);
create table if not exists fuel_issue_line_parts (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references fuel_issue_lines(id) on delete cascade,
  seq integer not null,
  kind text not null,
  purchase_id uuid references fuel_purchases(id) on delete set null,
  liters numeric(12,2) not null,
  price_per_liter numeric(8,2),
  amount numeric(14,2)
);
create index if not exists fuel_issue_line_parts_line_idx on fuel_issue_line_parts(line_id);
-- After deploying: save any purchase (or press "ยืนยัน" on one) once so the open slips are cut into their bills.
-- fuel_issues.price_purchase_id (2026-11-25-issue-bill.sql) and fuel_prices are no longer used.
