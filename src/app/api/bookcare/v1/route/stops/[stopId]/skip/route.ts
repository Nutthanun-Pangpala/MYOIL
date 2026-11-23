import { checkSkipRequest } from "@/domain/bookcare-api";
import { apiError, handlePost } from "@/server/bookcare/http";
import { skipStop } from "@/server/routes/route-service";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** API 9 — the driver skipped a stop, with a reason (R21). Same skipRef twice = one skip. */
export async function POST(req: Request, { params }: { params: Promise<{ stopId: string }> }) {
  const { stopId } = await params;
  if (!UUID.test(stopId)) return apiError(404, "not_found", "ไม่มีจุดนี้ในเส้นทาง");
  return handlePost(req, checkSkipRequest, (v) => skipStop(stopId, v));
}
