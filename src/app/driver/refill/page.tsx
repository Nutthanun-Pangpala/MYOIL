import { requireDriver } from "@/lib/session";
import { RefillForm } from "./refill-form";

export const metadata = { title: "เติมน้ำมันเข้ารถ" };

/** fuel bought into the truck (design board Refill): liters + bill amount + bill photo; the admin confirms the price */
export default async function RefillPage() {
  const s = await requireDriver();
  return <RefillForm driverName={s.name} />;
}
