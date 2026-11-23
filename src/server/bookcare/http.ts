import { createHash, timingSafeEqual } from "node:crypto";

export function apiError(status: number, code: string, message: string, field?: string): Response {
  return Response.json({ error: { code, message, ...(field ? { field } : {}) } }, { status, headers: { "Cache-Control": "no-store" } });
}

export const ok = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Bearer key "ก." (BookCare calls MYOIL). Returns an error response, or null when the key is right. A missing env key rejects everything. */
export function checkPushKey(req: Request, env: Record<string, string | undefined> = process.env): Response | null {
  const key = env.BOOKCARE_PUSH_KEY;
  const given = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";
  // compare digests: fixed length, constant time
  const same = !!key && key.length >= 32 && timingSafeEqual(digest(key), digest(given));
  return same ? null : apiError(401, "unauthorized", "กุญแจไม่ถูกต้อง");
}

/** reads the JSON body (≤ 4 MB); returns the body or an error response */
export async function readJson(req: Request): Promise<{ body: unknown } | { error: Response }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 4_000_000) return { error: apiError(413, "too_large", "คำขอใหญ่เกิน 4 MB") };
  const text = await req.text();
  if (text.length > 4_000_000) return { error: apiError(413, "too_large", "คำขอใหญ่เกิน 4 MB") };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: apiError(400, "invalid", "คำขอไม่ใช่ JSON ที่ถูกต้อง", "body") };
  }
}

/** the shared shell of every POST: key → JSON → check → service → answer */
export async function handlePost<T, R>(
  req: Request,
  check: (body: unknown) => { ok: true; value: T } | { ok: false; field: string; message: string },
  run: (value: T) => Promise<{ ok: true; status: number; body: R } | { ok: false; status: number; code: string; message: string; field?: string }>,
): Promise<Response> {
  const denied = checkPushKey(req);
  if (denied) return denied;
  const read = await readJson(req);
  if ("error" in read) return read.error;
  const checked = check(read.body);
  if (!checked.ok) return apiError(400, "invalid", checked.message, checked.field);
  try {
    const r = await run(checked.value);
    return r.ok ? ok(r.body, r.status) : apiError(r.status, r.code, r.message, r.field);
  } catch (e) {
    console.error("bookcare api failed", e instanceof Error ? e.message : "unknown");
    return apiError(500, "server_error", "ระบบขัดข้อง ลองส่งใหม่ภายหลัง");
  }
}

export const bangkokToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

/** the shared shell of every GET: key → answer */
export async function handleGet(req: Request, run: () => Promise<Response>): Promise<Response> {
  const denied = checkPushKey(req);
  if (denied) return denied;
  try {
    return await run();
  } catch (e) {
    console.error("bookcare api failed", e instanceof Error ? e.message : "unknown");
    return apiError(500, "server_error", "ระบบขัดข้อง ลองใหม่ภายหลัง");
  }
}
