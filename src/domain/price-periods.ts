import { addDays } from "./iso-date";

/**
 * The daily-price table as periods: a price is used from its date until the day before the next
 * price (brief §6.6 "ใช้ตั้งแต่วันที่ … ถึงวันที่ …"). The newest one has no end ("ยังใช้อยู่").
 */
export type PricePoint = { date: string; pricePerLiter: number; /** purchase = the day's price is the price paid that day; differs = a purchase was made that day at another price; manual = no purchase that day */
  source: "purchase" | "differs" | "manual" };
export type PricePeriod = PricePoint & { from: string; to: string | null };

export function pricePeriods(points: readonly PricePoint[]): PricePeriod[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return sorted
    .map((p, i) => ({ ...p, from: p.date, to: i + 1 < sorted.length ? addDays(sorted[i + 1].date, -1) : null }))
    .reverse(); // newest first, like the screen
}
