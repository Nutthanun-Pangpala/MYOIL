/** ISO `YYYY-MM-DD` date helpers. Pure string/UTC maths, so no time-zone surprises. */

const DAY_MS = 86_400_000;

export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** `YYYY-MM` of a date */
export const monthOf = (iso: string) => iso.slice(0, 7);

/** first and last day of a `YYYY-MM` month */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** the days of `month` up to and including `today`: all of a past month, this month so far (a month not begun: end < start) */
export function monthUpTo(month: string, today: string): { start: string; end: string } {
  const { start, end } = monthRange(month);
  return { start, end: today < end ? today : end };
}

/** the month `n` months before/after `month` (`YYYY-MM`) */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export const isMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** a real calendar day written `YYYY-MM-DD` (2026-11-31 is not one) */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}
