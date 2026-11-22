import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { canOpen } from "@/lib/nav";
import { getSession } from "@/lib/session";

/** bill photo of a purchase — only people who may open "ซื้อน้ำมันเข้า" */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !canOpen(session.role, "/purchases")) return new Response("forbidden", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("not found", { status: 404 });
  const [p] = await db.select().from(schema.purchaseBillPhotos).where(eq(schema.purchaseBillPhotos.purchaseId, id)).limit(1);
  if (!p) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(p.data), { headers: { "Content-Type": p.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
