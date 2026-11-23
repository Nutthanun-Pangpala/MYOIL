import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { canOpen } from "@/lib/nav";
import { getSession } from "@/lib/session";
import { visibleProjectIds } from "@/server/projects/project-scope";

/** the meter photo of one line of a phone slip — only people who may open "ใบจ่าย", and only for projects they may see */
export async function GET(_req: Request, { params }: { params: Promise<{ lineId: string }> }) {
  const session = await getSession();
  if (!session || !canOpen(session.role, "/issues")) return new Response("forbidden", { status: 403 });
  const { lineId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(lineId)) return new Response("not found", { status: 404 });
  const [row] = await db
    .select({ mime: schema.fuelIssueLinePhotos.mime, data: schema.fuelIssueLinePhotos.data, projectId: schema.fuelIssues.projectId })
    .from(schema.fuelIssueLinePhotos)
    .innerJoin(schema.fuelIssueLines, eq(schema.fuelIssueLines.id, schema.fuelIssueLinePhotos.lineId))
    .innerJoin(schema.fuelIssues, eq(schema.fuelIssues.id, schema.fuelIssueLines.issueId))
    .where(eq(schema.fuelIssueLinePhotos.lineId, lineId))
    .limit(1);
  if (!row) return new Response("not found", { status: 404 });
  const scope = await visibleProjectIds(session);
  if (scope && !scope.includes(row.projectId)) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(row.data), { headers: { "Content-Type": row.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
