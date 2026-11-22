import { lineAmount } from "./money";
import { priceOn, type DailyPrice } from "./price";

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
 * After a price is added or corrected: every line of an open cycle gets the price of its date.
 * Only lines whose price actually changes (or that were waiting) are returned.
 */
export type OpenLine = PendingLine & { currentPrice: number | null };
export type RepricedOpenLine = RepricedLine & { wasWaiting: boolean };

export function repriceOpen(lines: readonly OpenLine[], prices: readonly DailyPrice[]): RepricedOpenLine[] {
  const out: RepricedOpenLine[] = [];
  for (const l of lines) {
    const pricePerLiter = priceOn(prices, l.issueDate);
    if (pricePerLiter === null || pricePerLiter === l.currentPrice) continue;
    out.push({ id: l.id, pricePerLiter, amount: lineAmount(l.liters, pricePerLiter), wasWaiting: l.currentPrice === null });
  }
  return out;
}
