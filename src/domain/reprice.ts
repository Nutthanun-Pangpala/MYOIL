import { lineAmount } from "./money";
import { latestOn, priceOn, type Bill, type DailyPrice } from "./price";

/**
 * Lines saved as "รอราคา" get their price when one appears (brief §7). Pure: returns only the
 * lines that can now be priced; the rest stay waiting.
 */
export type PendingLine = { id: string; issueDate: string; liters: number };
export type RepricedLine = { id: string; pricePerLiter: number; amount: number };

export function repricePending(lines: readonly PendingLine[], prices: readonly DailyPrice[]): RepricedLine[] {
  const out: RepricedLine[] = [];
  for (const l of lines) {
    const pricePerLiter = priceOn(prices, l.issueDate);
    if (pricePerLiter !== null) out.push({ id: l.id, pricePerLiter, amount: lineAmount(l.liters, pricePerLiter) });
  }
  return out;
}

/**
 * After a purchase bill is added, corrected, cancelled or brought back: every line of an open cycle gets the
 * price of the bill of its date. Only lines whose price actually changes are returned — a line that was waiting
 * gets its first price, and a line whose only bill went away goes back to waiting (price and amount null).
 */
export type OpenLine = PendingLine & { currentPrice: number | null };
export type RepricedOpenLine = { id: string; pricePerLiter: number | null; amount: number | null; wasWaiting: boolean };

export function repriceOpen(lines: readonly OpenLine[], prices: readonly DailyPrice[]): RepricedOpenLine[] {
  const out: RepricedOpenLine[] = [];
  for (const l of lines) {
    const pricePerLiter = priceOn(prices, l.issueDate);
    if (pricePerLiter === l.currentPrice) continue;
    out.push({ id: l.id, pricePerLiter, amount: pricePerLiter === null ? null : lineAmount(l.liters, pricePerLiter), wasWaiting: l.currentPrice === null });
  }
  return out;
}

/** which bill each slip draws on now; only slips whose bill changed are returned */
export function rebill(issues: readonly { id: string; issueDate: string; billId: string | null }[], bills: readonly Bill[]): { id: string; billId: string | null }[] {
  const out: { id: string; billId: string | null }[] = [];
  for (const i of issues) {
    const billId = latestOn(bills, i.issueDate)?.id ?? null;
    if (billId !== i.billId) out.push({ id: i.id, billId });
  }
  return out;
}
