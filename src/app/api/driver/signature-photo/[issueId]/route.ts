import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { driverSession } from "@/server/driver/api";

/** the receiver's signature of a slip made on the phone, for the driver's "ใบจ่ายของ …" page */
export async function GET(req: Request, { params }: { params: Promise<{ issueId: string }> }) {
  const who = await driverSession(req);
  if ("error" in who) return who.error;
  const { issueId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(issueId)) return new Response("not found", { status: 404 });
  const [row] = await db
    .select({ mime: schema.issueSignedPhotos.mime, data: schema.issueSignedPhotos.data, source: schema.fuelIssues.source })
    .from(schema.issueSignedPhotos)
    .innerJoin(schema.fuelIssues, eq(schema.fuelIssues.id, schema.issueSignedPhotos.issueId))
    .where(eq(schema.issueSignedPhotos.issueId, issueId))
    .limit(1);
  if (!row || row.source !== "mobile") return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(row.data), { headers: { "Content-Type": row.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
