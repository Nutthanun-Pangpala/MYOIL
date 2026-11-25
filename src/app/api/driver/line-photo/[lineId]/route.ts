import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { driverSession } from "@/server/driver/api";

/** a meter photo of a slip made on the phone, for the driver's own "ใบจ่ายของ …" page */
export async function GET(req: Request, { params }: { params: Promise<{ lineId: string }> }) {
  const who = await driverSession(req);
  if ("error" in who) return who.error;
  const { lineId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(lineId)) return new Response("not found", { status: 404 });
  const [row] = await db
    .select({ mime: schema.fuelIssueLinePhotos.mime, data: schema.fuelIssueLinePhotos.data, source: schema.fuelIssues.source })
    .from(schema.fuelIssueLinePhotos)
    .innerJoin(schema.fuelIssueLines, eq(schema.fuelIssueLines.id, schema.fuelIssueLinePhotos.lineId))
    .innerJoin(schema.fuelIssues, eq(schema.fuelIssues.id, schema.fuelIssueLines.issueId))
    .where(eq(schema.fuelIssueLinePhotos.lineId, lineId))
    .limit(1);
  if (!row || row.source !== "mobile") return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(row.data), { headers: { "Content-Type": row.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
