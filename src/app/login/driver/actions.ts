"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { LOCK_MIN, MAX_TRIES, afterWrongPin, isPin, lockedMinutes, normalizePhone } from "@/domain/driver-login";
import { verifySecret } from "@/lib/password";
import { forgetDriverCookie, rememberDriver } from "@/lib/remember";
import { createSession } from "@/lib/session";

/** `phone` comes back so a refused login keeps it; `at` makes each refusal a new message */
/** `field` = where the cursor goes back to; `locked` = minutes the account rests (the keypad stops taking a PIN) */
export type DriverLoginState = { error?: string; phone?: string; at?: number; field?: "phone" | "pin"; locked?: number } | undefined;

const WRONG = "เบอร์โทรหรือรหัส PIN ไม่ถูกต้อง";
const CLOSED = "บัญชีนี้ถูกปิดการใช้งาน ติดต่อแอดมินสโตร์กลาง";
const locked = (min: number) => `ใส่ผิดเกิน ${MAX_TRIES} ครั้ง ระบบพักไว้ ${min} นาที แล้วลองใหม่ หรือให้ผู้ดูแลระบบ MYOIL ตั้ง PIN ใหม่ให้`;
// checked against this when the phone is unknown, so "no such driver" costs the same time as "wrong PIN"
const DUMMY_HASH = "00".repeat(16) + ":" + "00".repeat(64);

export async function loginDriver(_prev: DriverLoginState, fd: FormData): Promise<DriverLoginState> {
  const typed = String(fd.get("phone") ?? "").trim();
  const pin = String(fd.get("pin") ?? "").trim();
  const at = Date.now();
  const phone = normalizePhone(typed);
  if (!phone) return { error: "เบอร์โทรต้องมี 10 หลัก ขึ้นต้นด้วย 0", phone: typed, at, field: "phone" };
  if (!isPin(pin)) return { error: "ใส่ PIN ให้ครบ 6 หลัก", phone: typed, at, field: "pin" };
  const [u] = phone ? await db.select().from(schema.users).where(and(eq(schema.users.phone, phone), eq(schema.users.role, "driver"))).limit(1) : [];

  if (u) {
    const min = lockedMinutes(u.lockedUntil, at);
    if (min) return { error: locked(min), phone: typed, at, field: "pin", locked: min };
  }
  const good = isPin(pin) && verifySecret(pin, u?.passwordHash ?? DUMMY_HASH);
  if (!u) {
    if (!isPin(pin)) verifySecret(pin, DUMMY_HASH);
    return { error: WRONG, phone: typed, at };
  }
  if (!good) {
    const next = afterWrongPin(u.failedLogins, u.lockedUntil, at);
    await db
      .update(schema.users)
      .set({ failedLogins: next.failed, lockedUntil: next.lock ? new Date(at + LOCK_MIN * 60_000) : null })
      .where(eq(schema.users.id, u.id));
    return { error: next.lock ? locked(LOCK_MIN) : `${WRONG} เหลืออีก ${next.left} ครั้ง`, phone: typed, at, field: "pin", locked: next.lock ? LOCK_MIN : undefined };
  }
  if (!u.active) return { error: CLOSED, phone: typed, at, field: "phone" };
  if (u.failedLogins || u.lockedUntil) await db.update(schema.users).set({ failedLogins: 0, lockedUntil: null }).where(eq(schema.users.id, u.id));

  await createSession({ userId: u.id, role: u.role, name: u.name });
  await rememberDriver({ phone: u.phone ?? typed, name: u.name });
  redirect("/driver");
}

/** "ไม่ใช่ฉัน ใช้เบอร์อื่น": this device forgets whose phone it was */
export async function forgetDriver() {
  await forgetDriverCookie();
}
