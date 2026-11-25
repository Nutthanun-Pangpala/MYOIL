/**
 * Fuel price lookup. Since 25 Nov 2026 (owner) there is no daily price list: a slip is priced by the
 * purchase bill it draws on = the latest bill dated on or before the slip's date.
 * Dates are ISO `YYYY-MM-DD` strings (they sort as text).
 */

export type DailyPrice = { date: string; pricePerLiter: number };
/** a purchase bill as a price: `id` = the purchase */
export type Bill = DailyPrice & { id: string };

/**
 * The item in force on a date: the latest one dated on or before it. Two on the same day → the later one in
 * the list wins (lists of bills come oldest-recorded first, so the bill recorded last decides).
 * null when nothing is on or before the date — the caller must say so ("รอราคา"), not guess.
 */
export function latestOn<T extends { date: string }>(items: readonly T[], date: string): T | null {
  let best: T | null = null;
  for (const p of items) {
    if (p.date <= date && (best === null || p.date >= best.date)) best = p;
  }
  return best;
}

export function priceOn(prices: readonly DailyPrice[], date: string): number | null {
  return latestOn(prices, date)?.pricePerLiter ?? null;
}
