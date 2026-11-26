import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ProjectSource } from "./project-source";

/**
 * BookCare's list → `projects` (owner, 26 Nov 2026: the list is synced AND admins add / change projects in MYOIL).
 * - a project BookCare has and MYOIL does not: added.
 * - a project nobody touched in MYOIL: code, name and open/closed follow BookCare.
 * - a project an admin added, edited, opened or closed in MYOIL (`local_edit_at` set): left exactly as it is —
 *   only `synced_at` moves. MYOIL's hand always wins, so a sync never undoes an admin's work.
 * - a project missing from BookCare's list: closed, never deleted (slips and invoices point at it) — unless it was
 *   added or touched by hand.
 */
export async function syncProjects(source: ProjectSource): Promise<{ upserted: number; deactivated: number }> {
  const rows = await source.list();
  const now = new Date();

  return db.transaction(async (tx) => {
    for (const r of rows) {
      await tx
        .insert(schema.projects)
        .values({ ...r, syncedAt: now })
        .onConflictDoUpdate({
          target: schema.projects.refCode,
          set: {
            projectCode: sql`case when ${schema.projects.localEditAt} is null then excluded.project_code else ${schema.projects.projectCode} end`,
            name: sql`case when ${schema.projects.localEditAt} is null then excluded.name else ${schema.projects.name} end`,
            isActive: sql`case when ${schema.projects.localEditAt} is null then excluded.is_active else ${schema.projects.isActive} end`,
            syncedAt: now,
          },
        });
    }
    const gone = await tx
      .update(schema.projects)
      .set({ isActive: false })
      .where(and(lt(schema.projects.syncedAt, now), eq(schema.projects.isActive, true), isNull(schema.projects.localEditAt)))
      .returning({ id: schema.projects.id });
    return { upserted: rows.length, deactivated: gone.length };
  });
}
