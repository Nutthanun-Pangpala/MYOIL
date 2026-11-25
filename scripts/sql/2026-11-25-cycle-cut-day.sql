-- 25 Nov 2026 (owner): claim cycles are cut on a set day of every month (e.g. the 21st). null = end of the calendar month.
-- Run on Neon BEFORE deploying this version (backup branch first). Safe to run twice.
alter table app_settings add column if not exists cycle_cut_day integer;
