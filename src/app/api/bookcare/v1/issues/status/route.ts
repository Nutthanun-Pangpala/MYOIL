import { apiError, handleGet, ok } from "@/server/bookcare/http";
import { issueStatuses, parseRefs } from "@/server/bookcare/read-service";

export const dynamic = "force-dynamic";

/** API 6 — number and review state of slips already sent. No prices, no amounts, no admin reasons. */
export async function GET(req: Request) {
  return handleGet(req, async () => {
    const q = parseRefs(new URL(req.url).searchParams.get("refs"));
    if (!q.ok) return apiError(400, "invalid", q.message, "refs");
    return ok(await issueStatuses(q.refs));
  });
}
