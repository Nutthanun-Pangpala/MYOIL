import { BookcareApiProjectSource, bookcareApiConfigured } from "./bookcare-api-source";
import { syncProjects } from "./sync-projects";

let lastTry = 0;

/** daily by Cron, and once when a phone slip names a project MYOIL doesn't know yet (not more than once a minute) */
export async function syncProjectsFromBookcare(opts: { throttle?: boolean } = {}): Promise<{ ok: true; upserted: number; deactivated: number } | { ok: false; message: string }> {
  if (!bookcareApiConfigured()) return { ok: false, message: "ยังไม่ได้ตั้ง BOOKCARE_API_URL และ BOOKCARE_PULL_KEY" };
  if (opts.throttle && Date.now() - lastTry < 60_000) return { ok: false, message: "เพิ่งซิงก์ไป รอสักครู่" };
  lastTry = Date.now();
  try {
    return { ok: true, ...(await syncProjects(new BookcareApiProjectSource())) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "ซิงก์ไม่สำเร็จ" };
  }
}
