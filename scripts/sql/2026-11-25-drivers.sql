-- 25 Nov 2026: fuel-truck drivers sign in to MYOIL (phone + PIN). Run on Neon BEFORE deploying the code.
-- Backup branch first, ask the owner. ADD VALUE on its own (not inside a transaction with the rest).
ALTER TYPE role ADD VALUE IF NOT EXISTS 'driver';

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_logins integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone);
