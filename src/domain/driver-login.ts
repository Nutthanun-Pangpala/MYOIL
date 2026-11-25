/** Pure rules of the driver's phone + PIN login (25 Nov 2026). */

/** digits only; a Thai mobile is 10 digits starting with 0 ("081-234 5678" → "0812345678"). null = not a phone */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  return /^0\d{9}$/.test(d) ? d : null;
}

export const isPin = (raw: string) => /^\d{6}$/.test(raw);

/** drivers have no email; the column is unique and required, so they get one nobody can receive mail at */
export const driverEmail = (phone: string) => `${phone}@driver.invalid`;

export const MAX_TRIES = 5;
export const LOCK_MIN = 5;

/** minutes still locked (0 = not locked) */
export function lockedMinutes(lockedUntil: Date | null, now: number): number {
  if (!lockedUntil) return 0;
  const ms = lockedUntil.getTime() - now;
  return ms > 0 ? Math.ceil(ms / 60_000) : 0;
}

/** after one more wrong PIN: the new counter, and whether the account now rests */
export function afterWrongPin(failed: number, lockedUntil: Date | null, now: number): { failed: number; lock: boolean; left: number } {
  // a lock that has run out starts the count again
  const n = (lockedUntil && lockedMinutes(lockedUntil, now) === 0 ? 0 : failed) + 1;
  const lock = n >= MAX_TRIES;
  return { failed: lock ? 0 : n, lock, left: lock ? 0 : MAX_TRIES - n };
}
