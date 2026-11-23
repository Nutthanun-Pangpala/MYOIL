import { createHash, timingSafeEqual } from "node:crypto";
import { syncProjectsFromBookcare } from "@/server/projects/sync-from-bookcare";

export const dynamic = "force-dynamic";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Vercel Cron, once a day: pulls the project list from BookCare (API 7). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!secret || secret.length < 16 || !timingSafeEqual(digest(secret), digest(given))) return new Response("unauthorized", { status: 401 });
  const r = await syncProjectsFromBookcare();
  return Response.json(r, { status: r.ok ? 200 : 502 });
}
