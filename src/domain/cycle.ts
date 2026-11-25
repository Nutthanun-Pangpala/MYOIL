import { sumLiters } from "./money";
/**
 * Claim cycles (รอบเคลม). Open question 1: calendar month or cut-off on the 20th?
 * So a cycle is just two dates stored as data — nothing in the code assumes "a month".
 * New cycles are made from the cut day in settings (`cycleContaining`); `calendarMonthCycle` = no cut day set.
 */

export type CycleDates = { start: string; end: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** the calendar month containing `date` */
export function calendarMonthCycle(date: string): CycleDates {
  const [y, m] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last day of this one
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
}

const DAY = 86_400_000;
export const dayAfter = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
export const dayBefore = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - DAY).toISOString().slice(0, 10);

/**
 * The day of the month a cycle is cut on (owner, 25 Nov 2026: "ปิดรอบวันที่ 21 ของทุกเดือน"): 1–28, or null = the
 * last day of the calendar month. A cycle then runs from the day after one cut to the next cut — which slips are
 * in it depends on their dates only, never on the day somebody presses "ปิดรอบ".
 */
export type CutDay = number | null;
export const isCutDay = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 28;

/** the cycle that contains `date` under a cut day: cut 21 → 22 Oct – 21 Nov holds 5 Nov, 22 Nov – 21 Dec holds 25 Nov */
export function cycleContaining(date: string, cut: CutDay): CycleDates {
  if (cut === null) return calendarMonthCycle(date);
  const [y, m, d] = date.split("-").map(Number);
  const cutOf = (yy: number, mm: number) => new Date(Date.UTC(yy, mm - 1, cut)).toISOString().slice(0, 10); // month 0 / 13 roll over
  return d <= cut ? { start: dayAfter(cutOf(y, m - 1)), end: cutOf(y, m) } : { start: dayAfter(cutOf(y, m)), end: cutOf(y, m + 1) };
}

/** the cycle that follows one ending on `end`: it starts the very next day (no gap, no overlap) and runs to the next cut */
export function nextCycleAfter(end: string, cut: CutDay = null): CycleDates {
  const start = dayAfter(end);
  return { start, end: cycleContaining(start, cut).end };
}

/** cycles in a row from `anchor`: at least `min` of them, and far enough to hold `through` */
export function cycleRanges(anchor: string, cut: CutDay, min: number, through: string): CycleDates[] {
  const out: CycleDates[] = [{ start: anchor, end: cycleContaining(anchor, cut).end }];
  while (out.length < min || out[out.length - 1].end < through) out.push(nextCycleAfter(out[out.length - 1].end, cut));
  return out;
}

/** two cycles must never overlap */
export function overlaps(a: CycleDates, b: CycleDates): boolean {
  return a.start <= b.end && b.start <= a.end;
}

// ───────────── closing a cycle (BA 22 Nov 2026) ─────────────

/**
 * On close, signed slips make the invoices; unsigned ones are carried to the next cycle
 * (they keep their date and price) so they are invoiced once the paper comes back signed.
 * Cancelled slips take no part.
 */
export function planClose(slips: { id: string; signed: boolean; cancelled: boolean; liters: number }[]) {
  const live = slips.filter((s) => !s.cancelled);
  const carry = live.filter((s) => !s.signed);
  return {
    invoiceSlips: live.length - carry.length,
    carryIds: carry.map((s) => s.id),
    carryLiters: sumLiters(carry.map((s) => s.liters)),
  };
}

export function reopenReasonError(reason: string): string | null {
  return reason.trim() ? null : "ต้องใส่เหตุผลก่อนจึงจะเปิดรอบได้";
}

export type InvoiceStatus = "draft" | "sent_to_pm" | "pm_signed" | "sent_to_accounting";
export const INVOICE_FLOW: InvoiceStatus[] = ["draft", "sent_to_pm", "pm_signed", "sent_to_accounting"];
export const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  draft: "ร่าง",
  sent_to_pm: "ส่งให้ PM แล้ว",
  pm_signed: "PM เซ็นแล้ว",
  sent_to_accounting: "ส่งบัญชีแล้ว",
};
export const nextInvoiceStatus = (s: InvoiceStatus): InvoiceStatus | null => INVOICE_FLOW[INVOICE_FLOW.indexOf(s) + 1] ?? null;
