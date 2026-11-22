/** Daily fuel price lookup. Dates are ISO `YYYY-MM-DD` strings (they sort as text). */

export type DailyPrice = { date: string; pricePerLiter: number };

/**
 * Price for a date. Brief §7: a date with no price uses the latest earlier price.
 * Returns null when no price exists on or before the date — the caller must say so, not guess.
 */
export function priceOn(prices: readonly DailyPrice[], date: string): number | null {
  let best: DailyPrice | null = null;
  for (const p of prices) {
    if (p.date <= date && (best === null || p.date > best.date)) best = p;
  }
  return best ? best.pricePerLiter : null;
}
