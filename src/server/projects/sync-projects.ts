import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ProjectSource } from "./project-source";

/**
 * The ONLY code that writes to `projects`. Upserts by ref_code; a project missing from the source
 * is marked inactive, never deleted (issues and invoices still point at it).
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
          set: { projectCode: r.projectCode, name: r.name, isActive: r.isActive, syncedAt: now },
        });
    }
    const gone = await tx
      .update(schema.projects)
      .set({ isActive: false })
      .where(and(lt(schema.projects.syncedAt, now), eq(schema.projects.isActive, true)))
      .returning({ id: schema.projects.id });
    return { upserted: rows.length, deactivated: gone.length };
  });
}
