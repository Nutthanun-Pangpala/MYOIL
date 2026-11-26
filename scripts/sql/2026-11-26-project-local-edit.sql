-- 26 Nov 2026 (owner: "ต้องการซิงด้วย เพิ่มเองได้ด้วย"): projects come from BookCare AND can be added / changed in MYOIL.
-- Run on Neon BEFORE deploying this version (backup branch first). Safe to run twice.
alter table projects add column if not exists local_edit_at timestamptz;
alter table projects add column if not exists added_locally boolean not null default false;
-- OBS-23: where the site is (address / landmark), shown on the driver's phone
alter table projects add column if not exists site_detail text;
