import { checkSkipRequest } from "@/domain/bookcare-api";
import { apiError } from "@/server/bookcare/http";
import { driverPost } from "@/server/driver/api";
import { skipStop } from "@/server/routes/route-service";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** the driver skips a stop with a reason (same rules as API 9) */
export async function POST(req: Request, { params }: { params: Promise<{ stopId: string }> }) {
  const { stopId } = await params;
  if (!UUID.test(stopId)) return apiError(404, "not_found", "ไม่มีจุดนี้ในเส้นทาง");
  return driverPost(req, checkSkipRequest, (v) => skipStop(stopId, v));
}
