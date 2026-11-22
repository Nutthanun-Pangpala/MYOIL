import { desc, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { priceOn } from "@/domain/price";

/** Price for a date: that day's, else the latest earlier one, else null (= รอราคา). Rule lives in domain/price.ts. */
export async function priceForDate(date: string): Promise<number | null> {
  const rows = await db
    .select({ date: schema.fuelPrices.priceDate, pricePerLiter: schema.fuelPrices.pricePerLiter })
    .from(schema.fuelPrices)
    .where(lte(schema.fuelPrices.priceDate, date))
    .orderBy(desc(schema.fuelPrices.priceDate))
    .limit(1);
  return priceOn(rows, date);
}
