import { sumLiters } from "./money";
/**
 * Claim cycles (รอบเคลม). Open question 1: calendar month or cut-off on the 20th?
 * So a cycle is just two dates stored as data — nothing in the code assumes "a month".
 * `calendarMonthCycle` is only the default for creating one.
 */

export type CycleDates = { start: string; end: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** the calendar month containing `date` */
export function calendarMonthCycle(date: string): CycleDates {
  const [y, m] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last day of this one
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
}

/** the default cycle that follows one ending on `end` (system makes the next cycle by itself) */
export function nextCycleAfter(end: string): CycleDates {
  const next = new Date(Date.parse(`${end}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return calendarMonthCycle(next);
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
