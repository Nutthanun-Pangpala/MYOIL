import { asc, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { latestOn, type Bill } from "@/domain/price";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Every purchase bill that counts as a price, oldest first (by date, then by when it was recorded).
 * Owner, 25 Nov 2026: no daily price list — a slip uses the price of the latest bill dated on or before it.
 * A bill sent from the driver's phone counts at once, before the admin confirms it; a cancelled bill never counts.
 */
export async function loadBills(q: Tx | typeof db = db): Promise<Bill[]> {
  const rows = await q
    .select({ id: schema.fuelPurchases.id, date: schema.fuelPurchases.purchaseDate, pricePerLiter: schema.fuelPurchases.pricePerLiter })
    .from(schema.fuelPurchases)
    .where(isNull(schema.fuelPurchases.cancelledAt))
    .orderBy(asc(schema.fuelPurchases.purchaseDate), asc(schema.fuelPurchases.createdAt));
  return rows;
}

/** the bill a slip of this date draws on, or null (= รอราคา) */
export async function billForDate(date: string, q: Tx | typeof db = db): Promise<Bill | null> {
  return latestOn(await loadBills(q), date);
}

export async function priceForDate(date: string): Promise<number | null> {
  return (await billForDate(date))?.pricePerLiter ?? null;
}
