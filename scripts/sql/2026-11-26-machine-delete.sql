-- 26 Nov 2026 (owner: machines can be deleted). Run on Neon BEFORE deploying this version (backup branch first). Safe to run twice.
alter table machines add column if not exists deleted_at timestamptz;
