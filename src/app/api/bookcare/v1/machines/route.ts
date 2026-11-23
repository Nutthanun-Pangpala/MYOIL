import { createHash } from "node:crypto";
import { bangkokToday, handleGet, ok } from "@/server/bookcare/http";
import { machinesForPhone } from "@/server/bookcare/read-service";

export const dynamic = "force-dynamic";

/** API 4 — the machine list (+ where each was filled, biggest fill in 90 days). `If-None-Match` → 304 when nothing changed. */
export async function GET(req: Request) {
  return handleGet(req, async () => {
    const list = await machinesForPhone(bangkokToday());
    const etag = `"${createHash("sha256").update(JSON.stringify(list)).digest("hex").slice(0, 32)}"`;
    if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-store" } });
    const res = ok({ etag, machines: list });
    res.headers.set("ETag", etag);
    return res;
  });
}
