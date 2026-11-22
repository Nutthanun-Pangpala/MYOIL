import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Session } from "@/lib/session";
import { seesAllProjects } from "@/lib/permissions";

/** null = every project; otherwise only these ids (project_viewer). Apply it in EVERY query that reads project data. */
export async function visibleProjectIds(session: Session): Promise<string[] | null> {
  if (seesAllProjects(session)) return null;
  const rows = await db
    .select({ id: schema.userProjects.projectId })
    .from(schema.userProjects)
    .where(eq(schema.userProjects.userId, session.userId));
  return rows.map((r) => r.id);
}
