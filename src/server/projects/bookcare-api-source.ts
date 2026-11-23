import type { ProjectRecord, ProjectSource } from "./project-source";

/**
 * API 7 of the BookCare contract: MYOIL asks BookCare for its project list (Bearer BOOKCARE_PULL_KEY).
 * Pure part first (`toProjectRecords`), so the checks are testable without a network.
 */
export class ProjectListError extends Error {}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** accepts `{ projects: [...] }` or a bare array; snake_case or camelCase keys. Refuses an empty list (a broken answer must not deactivate every project). */
export function toProjectRecords(body: unknown): ProjectRecord[] {
  const list = Array.isArray(body) ? body : body && typeof body === "object" ? (body as { projects?: unknown }).projects : undefined;
  if (!Array.isArray(list)) throw new ProjectListError("BookCare ตอบรายชื่อโครงการในรูปแบบที่ไม่รู้จัก");
  if (list.length === 0) throw new ProjectListError("BookCare ส่งรายชื่อโครงการว่างเปล่า ไม่ปรับข้อมูลใน MYOIL");
  const seen = new Set<string>();
  return list.map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const refCode = text(r.refCode ?? r.ref_code);
    const name = text(r.name);
    if (!refCode || !name) throw new ProjectListError(`โครงการแถวที่ ${i + 1} ไม่มีรหัสหรือชื่อ`);
    if (seen.has(refCode)) throw new ProjectListError(`รหัสโครงการ ${refCode} ซ้ำกันในรายชื่อ`);
    seen.add(refCode);
    return { refCode, projectCode: text(r.projectCode ?? r.project_code) || null, name, isActive: (r.isActive ?? r.is_active) !== false };
  });
}

export const bookcareApiConfigured = (env: Record<string, string | undefined> = process.env) => !!env.BOOKCARE_API_URL && !!env.BOOKCARE_PULL_KEY;

export class BookcareApiProjectSource implements ProjectSource {
  constructor(private readonly env: Record<string, string | undefined> = process.env, private readonly doFetch: typeof fetch = fetch) {}

  async list(): Promise<ProjectRecord[]> {
    if (!bookcareApiConfigured(this.env)) throw new ProjectListError("ยังไม่ได้ตั้ง BOOKCARE_API_URL และ BOOKCARE_PULL_KEY");
    const url = `${this.env.BOOKCARE_API_URL!.replace(/\/+$/, "")}/api/myoil/v1/projects`;
    let res: Response;
    try {
      res = await this.doFetch(url, { headers: { Authorization: `Bearer ${this.env.BOOKCARE_PULL_KEY}`, Accept: "application/json" }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    } catch {
      throw new ProjectListError("ติดต่อ BookCare ไม่ได้ (หมดเวลาหรือเชื่อมต่อไม่ได้)");
    }
    if (res.status === 401) throw new ProjectListError("BookCare ไม่รับกุญแจ (401) ตรวจ BOOKCARE_PULL_KEY");
    if (!res.ok) throw new ProjectListError(`BookCare ตอบ ${res.status}`);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ProjectListError("BookCare ตอบกลับมาไม่ใช่ JSON");
    }
    return toProjectRecords(body);
  }
}
