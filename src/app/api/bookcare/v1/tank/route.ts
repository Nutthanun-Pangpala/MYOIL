import { bangkokToday, handleGet, ok } from "@/server/bookcare/http";
import { tankNow } from "@/server/bookcare/read-service";

export const dynamic = "force-dynamic";

/** API 5 — fuel in the truck now: the same figure as the side menu (cancelled slips out; waiting ones in). No money. */
export async function GET(req: Request) {
  return handleGet(req, async () => ok(await tankNow(bangkokToday())));
}
