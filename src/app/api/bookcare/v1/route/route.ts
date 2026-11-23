import { isRealDate } from "@/domain/bookcare-api";
import { apiError, bangkokToday, handleGet, ok } from "@/server/bookcare/http";
import { routeForPhone } from "@/server/routes/route-service";

export const dynamic = "force-dynamic";

/** API 8 — the route of a day (default today), stops in the admin's order with their status. No route → stops []. */
export async function GET(req: Request) {
  return handleGet(req, async () => {
    const date = new URL(req.url).searchParams.get("date") ?? bangkokToday();
    if (!isRealDate(date)) return apiError(400, "invalid", "วันที่ต้องเป็นรูปแบบ YYYY-MM-DD", "date");
    return ok(await routeForPhone(date));
  });
}
