import postgres from "postgres";
import type { ProjectRecord, ProjectSource } from "./project-source";

/** what BookCare's `projects` table gives us — only these 4 columns are ever read (the DB role is limited to them) */
export type BookcareRow = { ref_code: unknown; project_code: unknown; name: unknown; is_active: unknown };

export class ProjectSourceError extends Error {}

/**
 * Pure: BookCare rows → records. Refuses a list that would be unsafe to sync:
 * empty (syncProjects would close every project) or a repeated ref_code (the upsert is keyed on it).
 */
export function toProjectRecords(rows: readonly BookcareRow[]): ProjectRecord[] {
  if (rows.length === 0) throw new ProjectSourceError("BookCare ส่งรายชื่อโครงการมาว่าง ไม่ซิงก์ เพื่อไม่ให้โครงการเดิมถูกปิดทั้งหมด");
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const refCode = typeof r.ref_code === "string" ? r.ref_code.trim() : "";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!refCode || !name) throw new ProjectSourceError(`แถวที่ ${i + 1} จาก BookCare ไม่มีรหัสโครงการหรือชื่อ`);
    if (seen.has(refCode)) throw new ProjectSourceError(`รหัสโครงการ ${refCode} ซ้ำใน BookCare`);
    seen.add(refCode);
    const code = typeof r.project_code === "string" ? r.project_code.trim() : "";
    return { refCode, projectCode: code || null, name, isActive: r.is_active !== false };
  });
}

export function bookcareConfigured(): boolean {
  return !!process.env.BOOKCARE_DATABASE_URL;
}

/** reads BookCare's list with the read-only role in BOOKCARE_DATABASE_URL; one short connection per sync */
export class BookcareProjectSource implements ProjectSource {
  async list(): Promise<ProjectRecord[]> {
    const url = process.env.BOOKCARE_DATABASE_URL;
    if (!url) throw new ProjectSourceError("ยังไม่ได้ตั้ง BOOKCARE_DATABASE_URL");
    const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10, idle_timeout: 5 });
    try {
      const rows = await sql<BookcareRow[]>`select ref_code, project_code, name, is_active from projects`;
      return toProjectRecords(rows);
    } catch (e) {
      if (e instanceof ProjectSourceError) throw e;
      // never echo the driver's message: it can carry the host or user name
      throw new ProjectSourceError("เชื่อมต่อ BookCare ไม่ได้ ตรวจ BOOKCARE_DATABASE_URL และสิทธิ์อ่านตาราง projects");
    } finally {
      await sql.end({ timeout: 5 }).catch(() => {});
    }
  }
}
