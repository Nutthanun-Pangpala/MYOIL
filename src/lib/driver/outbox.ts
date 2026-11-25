"use client";

import { allOut, dropOut, putOut, type OutItem } from "./store";

export type SendResult = { ok: true; body: unknown } | { ok: false; offline: boolean; message: string };

/** one POST to MYOIL. `offline` = it never arrived (no signal, timeout, server down): safe to send again later. */
export async function post(url: string, body: unknown): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  } catch {
    return { ok: false, offline: true, message: "ไม่มีสัญญาณ" };
  }
  if (res.ok) return { ok: true, body: await res.json().catch(() => null) };
  if (res.status === 401) return { ok: false, offline: true, message: "ต้องเข้าสู่ระบบใหม่ก่อน แล้วระบบจะส่งให้เอง" };
  if (res.status >= 500 || res.status === 408 || res.status === 429) return { ok: false, offline: true, message: "ระบบยังไม่ตอบ จะลองส่งใหม่เอง" };
  const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return { ok: false, offline: false, message: data?.error?.message ?? "MYOIL ไม่รับรายการนี้" };
}

let busy: Promise<void> | null = null;

/** send everything that waits, oldest first. Refused items stay on the phone marked "ส่งไม่สำเร็จ" with the reason. */
export function flush(retryFailed = false): Promise<void> {
  busy ??= (async () => {
    try {
      const items = (await allOut()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const it of items) {
        if (it.state === "failed" && !retryFailed) continue;
        const r = await post(it.url, it.body);
        if (r.ok) await dropOut(it.ref);
        else if (r.offline) {
          if (it.state !== "waiting" || it.error !== r.message) await putOut({ ...it, state: "waiting", error: r.message });
          break; // no signal: the rest waits too
        } else await putOut({ ...it, state: "failed", error: r.message });
      }
    } finally {
      busy = null;
    }
  })();
  return busy;
}

/** keep it on the phone first, then try to send. Returns the server's answer when it went through right away. */
export async function sendOrKeep(item: Omit<OutItem, "state" | "error" | "createdAt">): Promise<SendResult> {
  const kept: OutItem = { ...item, createdAt: new Date().toISOString(), state: "waiting", error: null };
  await putOut(kept);
  const r = await post(item.url, item.body);
  if (r.ok) await dropOut(item.ref);
  else await putOut({ ...kept, state: r.offline ? "waiting" : "failed", error: r.message });
  return r;
}
