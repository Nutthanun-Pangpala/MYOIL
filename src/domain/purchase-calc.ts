import { TWO_DECIMALS_MESSAGE, hasAtMostTwoDecimals, lineAmount } from "./money";

/**
 * Fuel purchase: the admin fills two of {liters, price, amount} and the system fills the third (brief §6.6).
 * Pure. `null` = not filled.
 */
export type PurchaseNumbers = { liters: number | null; price: number | null; amount: number | null };

export type PurchaseResult =
  | { ok: true; liters: number; price: number; amount: number }
  | { ok: false; error: string; field?: "liters" | "price" | "amount" };

const positive = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** a bill's total may differ from liters × price by a rounding satang at most */
export const AMOUNT_TOLERANCE = 0.01;

export function completePurchase(p: PurchaseNumbers): PurchaseResult {
  const given = [p.liters, p.price, p.amount];
  if (given.some((v) => v !== null && !positive(v))) return { ok: false, error: "ตัวเลขต้องมากกว่า 0" };
  // what the admin typed must match the bill: refuse a 3rd decimal instead of rounding it away
  for (const [field, v] of [["liters", p.liters], ["price", p.price], ["amount", p.amount]] as const) {
    if (v !== null && !hasAtMostTwoDecimals(v)) return { ok: false, error: TWO_DECIMALS_MESSAGE, field };
  }

  const { liters, price, amount } = p;
  if (positive(liters) && positive(price) && positive(amount)) {
    const calc = lineAmount(liters, price);
    if (Math.abs(calc - amount) > AMOUNT_TOLERANCE) {
      return { ok: false, error: `จำนวนเงินไม่ตรงกับลิตร × ราคา (ควรเป็น ${calc.toFixed(2)})` };
    }
    return { ok: true, liters, price, amount };
  }
  if (positive(liters) && positive(price)) return { ok: true, liters, price, amount: lineAmount(liters, price) };
  if (positive(liters) && positive(amount)) return { ok: true, liters, price: round2(amount / liters), amount };
  if (positive(price) && positive(amount)) return { ok: true, liters: round2(amount / price), price, amount };
  return { ok: false, error: "กรอกอย่างน้อยสองช่องจากลิตร ราคา และจำนวนเงิน" };
}

/** BA's proposal (OBS-17): ask before saving a purchase that looks odd. Numbers are adjustable. */
export const ODD_PRICE_SHARE = 0.2; // price differs from the latest daily price by more than 20%
export const ODD_MIN_LITERS = 100;

export function purchaseOddities(p: { liters: number; price: number; dailyPrice: number | null; capacity: number | null }): string[] {
  const out: string[] = [];
  if (p.dailyPrice !== null && p.dailyPrice > 0 && Math.abs(p.price - p.dailyPrice) / p.dailyPrice > ODD_PRICE_SHARE) {
    out.push(`ราคา ${p.price.toFixed(2)} บาท/ลิตร ต่างจากราคาประจำวันล่าสุด ${p.dailyPrice.toFixed(2)} บาท เกิน ${ODD_PRICE_SHARE * 100}%`);
  }
  if (p.capacity !== null && p.liters > p.capacity) {
    out.push(`ซื้อ ${p.liters} ลิตร มากกว่าความจุถัง ${p.capacity} ลิตร`);
  }
  if (p.liters < ODD_MIN_LITERS) out.push(`ซื้อน้อยกว่า ${ODD_MIN_LITERS} ลิตร (${p.liters} ลิตร)`);
  return out;
}
