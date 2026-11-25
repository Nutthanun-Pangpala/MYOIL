import { randomInt } from "node:crypto";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { driverEmail, lockedMinutes, normalizePhone } from "@/domain/driver-login";
import { hashSecret } from "@/lib/password";

const { users } = schema;

/**
 * Accounts of the fuel-truck drivers (ตั้งค่า › ผู้ใช้ › คนขับรถเติมน้ำมัน): phone + 6-digit PIN.
 * The system makes the PIN and shows it once; nobody chooses or stores it in the clear.
 */
export type DriverErrors = Partial<Record<"name" | "phone", string>>;
export type DriverResult = { ok: true; message: string; pin?: string } | { ok: false; message?: string; errors?: DriverErrors };

const newPin = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export async function listDrivers(now = Date.now()) {
  const rows = await db
    .select({ id: users.id, name: users.name, phone: users.phone, active: users.active, lockedUntil: users.lockedUntil })
    .from(users)
    .where(eq(users.role, "driver"))
    .orderBy(desc(users.active), asc(users.name));
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone ?? "", active: r.active, lockedMinutes: lockedMinutes(r.lockedUntil, now) }));
}

async function check(i: { name: string; phone: string }, exceptId: string | null): Promise<{ errors: DriverErrors; phone: string | null }> {
  const errors: DriverErrors = {};
  if (!i.name.trim()) errors.name = "ใส่ชื่อ";
  const phone = normalizePhone(i.phone);
  if (!phone) errors.phone = "ใส่เบอร์มือถือ 10 หลัก ขึ้นต้นด้วย 0";
  else {
    const [dup] = await db.select({ name: users.name }).from(users).where(and(eq(users.phone, phone), exceptId ? ne(users.id, exceptId) : undefined)).limit(1);
    if (dup) errors.phone = `เบอร์นี้เป็นของ ${dup.name} อยู่แล้ว`;
  }
  return { errors, phone };
}

export async function createDriver(i: { name: string; phone: string }): Promise<DriverResult> {
  const { errors, phone } = await check(i, null);
  if (Object.keys(errors).length || !phone) return { ok: false, errors };
  const pin = newPin();
  await db.insert(users).values({ name: i.name.trim(), phone, email: driverEmail(phone), passwordHash: hashSecret(pin), role: "driver" });
  return { ok: true, message: "เพิ่มคนขับแล้ว", pin };
}

export async function updateDriver(id: string, i: { name: string; phone: string }): Promise<DriverResult> {
  const { errors, phone } = await check(i, id);
  if (Object.keys(errors).length || !phone) return { ok: false, errors };
  const r = await db.update(users).set({ name: i.name.trim(), phone, email: driverEmail(phone) }).where(and(eq(users.id, id), eq(users.role, "driver"))).returning({ id: users.id });
  return r.length ? { ok: true, message: "บันทึกคนขับแล้ว" } : { ok: false, message: "ไม่พบคนขับนี้" };
}

/** a new PIN; also ends a rest after too many wrong tries */
export async function resetDriverPin(id: string): Promise<DriverResult> {
  const pin = newPin();
  const r = await db.update(users).set({ passwordHash: hashSecret(pin), failedLogins: 0, lockedUntil: null }).where(and(eq(users.id, id), eq(users.role, "driver"))).returning({ id: users.id });
  return r.length ? { ok: true, message: "ตั้ง PIN ใหม่แล้ว", pin } : { ok: false, message: "ไม่พบคนขับนี้" };
}

export async function setDriverActive(id: string, active: boolean): Promise<DriverResult> {
  const r = await db.update(users).set({ active }).where(and(eq(users.id, id), eq(users.role, "driver"))).returning({ id: users.id });
  return r.length ? { ok: true, message: active ? "เปิดบัญชีแล้ว" : "ปิดบัญชีแล้ว" } : { ok: false, message: "ไม่พบคนขับนี้" };
}
