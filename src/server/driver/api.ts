import { getSession, type Session } from "@/lib/session";
import { apiError, ok, readJson } from "@/server/bookcare/http";

/**
 * The driver's phone talks to MYOIL directly (owner, 25 Nov 2026: fuel work left BookCare), so these routes use the
 * driver's own session instead of the system-to-system key. The checks and the services are the ones API 1/2/3/9 use.
 */
export type DriverIdentity = { bookcareUserId: string; name: string };

async function driver(req: Request): Promise<{ session: Session } | { error: Response }> {
  // a form on another site can't ride the cookie (SameSite=Lax); a script on another origin is refused here
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))) return { error: apiError(403, "forbidden", "ไม่อนุญาต") };
  const session = await getSession();
  if (!session || session.role !== "driver") return { error: apiError(401, "unauthorized", "เข้าสู่ระบบใหม่อีกครั้ง") };
  return { session };
}

export async function driverPost<T, R>(
  req: Request,
  check: (body: unknown) => { ok: true; value: T } | { ok: false; field: string; message: string },
  run: (value: T) => Promise<{ ok: true; status: number; body: R } | { ok: false; status: number; code: string; message: string; field?: string }>,
): Promise<Response> {
  const who = await driver(req);
  if ("error" in who) return who.error;
  const read = await readJson(req);
  if ("error" in read) return read.error;
  // who drove is the signed-in driver, whatever the phone wrote
  const identity: DriverIdentity = { bookcareUserId: who.session.userId, name: who.session.name };
  const body = typeof read.body === "object" && read.body !== null && !Array.isArray(read.body) ? { ...read.body, driver: identity } : read.body;
  const checked = check(body);
  if (!checked.ok) return apiError(400, "invalid", checked.message, checked.field);
  try {
    const r = await run(checked.value);
    return r.ok ? ok(r.body, r.status) : apiError(r.status, r.code, r.message, r.field);
  } catch (e) {
    console.error("driver api failed", e instanceof Error ? e.message : "unknown");
    return apiError(500, "server_error", "ระบบขัดข้อง ลองส่งใหม่ภายหลัง");
  }
}

export async function driverSession(req: Request) {
  return driver(req);
}
