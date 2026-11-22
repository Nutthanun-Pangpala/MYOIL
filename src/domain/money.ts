/**
 * Money maths for fuel lines. Pure: no DB, no Next.js.
 * Brief §7: amount = liters × price of the issue date, rounded to 2 decimals.
 *
 * Done in integers (satang / 1/100 litre) so 0.005 never lands on the wrong side of a float.
 */

const toHundredths = (n: number) => Math.round(n * 100);

/** liters × price per liter → baht, rounded half-up to 2 decimals */
export function lineAmount(liters: number, pricePerLiter: number): number {
  if (!Number.isFinite(liters) || !Number.isFinite(pricePerLiter)) {
    throw new RangeError("liters and price must be finite numbers");
  }
  // (liters×100) × (price×100) = baht × 10 000 → /100 = satang
  const satang = Math.round((toHundredths(liters) * toHundredths(pricePerLiter)) / 100);
  return satang / 100;
}

/** sum of baht amounts without float drift */
export function sumAmounts(amounts: number[]): number {
  return amounts.reduce((s, a) => s + toHundredths(a), 0) / 100;
}

/** sum of liters without float drift */
export function sumLiters(liters: number[]): number {
  return liters.reduce((s, l) => s + toHundredths(l), 0) / 100;
}

/** liters and prices are typed with at most 2 decimals, as on the paper slip (BA 22 Nov: refuse, never round) */
export function hasAtMostTwoDecimals(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

export const TWO_DECIMALS_MESSAGE = "ใส่ได้ไม่เกิน 2 ตำแหน่ง ตรวจกับใบอีกครั้ง";
