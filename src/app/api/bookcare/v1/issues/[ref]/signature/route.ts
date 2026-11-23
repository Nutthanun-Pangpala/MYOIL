import { checkSignatureRequest } from "@/domain/bookcare-api";
import { apiError, handlePost } from "@/server/bookcare/http";
import { receiveSignature } from "@/server/bookcare/receive-service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** API 3 — the receiver's signature asked for later; {ref} is the slip's phone ref, not its number */
export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!UUID.test(ref)) return apiError(400, "invalid", "ref ต้องเป็น UUID", "ref");
  return handlePost(req, checkSignatureRequest, (v) => receiveSignature(ref, v));
}
