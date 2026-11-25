import { checkSignatureRequest } from "@/domain/bookcare-api";
import { apiError } from "@/server/bookcare/http";
import { receiveSignature } from "@/server/bookcare/receive-service";
import { driverPost } from "@/server/driver/api";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** a signature asked for later, for a slip sent "ยังไม่เซ็นรับ" (same rules as API 3) */
export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!UUID.test(ref)) return apiError(404, "not_found", "ไม่พบใบที่มี ref นี้");
  return driverPost(req, checkSignatureRequest, (v) => receiveSignature(ref, v));
}
