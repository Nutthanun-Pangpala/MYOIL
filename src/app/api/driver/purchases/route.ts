import { checkPurchaseRequest } from "@/domain/bookcare-api";
import { receivePurchase } from "@/server/bookcare/receive-service";
import { driverPost } from "@/server/driver/api";

export const dynamic = "force-dynamic";

/** "เติมน้ำมันเข้ารถ": liters + bill amount + bill photo; the admin confirms the price (same rules as API 2) */
export async function POST(req: Request) {
  return driverPost(req, checkPurchaseRequest, receivePurchase);
}
