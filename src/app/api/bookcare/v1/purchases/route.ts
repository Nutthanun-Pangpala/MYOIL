import { checkPurchaseRequest } from "@/domain/bookcare-api";
import { handlePost } from "@/server/bookcare/http";
import { receivePurchase } from "@/server/bookcare/receive-service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** API 2 — fuel put into the truck (contract v1). Waits for an admin to confirm. */
export async function POST(req: Request) {
  return handlePost(req, checkPurchaseRequest, receivePurchase);
}
