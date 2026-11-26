import { isIsoDate } from "./iso-date";
import { TWO_DECIMALS_MESSAGE, hasAtMostTwoDecimals } from "./money";

/** Validation for the settings screens. Pure: every problem is returned at once, keyed by field. */

const dayAfter = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

export function validateCycleDates(a: {
  prev: { start: string; end: string } | null;
  next: { start: string; end: string } | null;
  start: string;
  end: string;
}): string | null {
  if (!isIsoDate(a.start) || !isIsoDate(a.end)) return "ใส่วันที่ให้ครบและถูกต้อง";
  if (a.end < a.start) return "วันสิ้นสุดอยู่ก่อนวันเริ่ม";
  if (a.prev && a.start !== dayAfter(a.prev.end)) return `วันเริ่มต้องเป็นวันถัดจากวันสิ้นสุดของรอบก่อน (${dayAfter(a.prev.end)}) รอบต้องต่อกันโดยไม่มีวันว่างและไม่ซ้อนกัน`;
  if (a.next && a.end >= a.next.end) return "วันสิ้นสุดต้องอยู่ก่อนวันสิ้นสุดของรอบถัดไป เพื่อให้รอบถัดไปเหลืออย่างน้อย 1 วัน";
  return null;
}

export type TankErrors = { capacity?: string; low?: string; opening?: string; openingPrice?: string };

export function validateTank(t: { capacity: number | null; low: number | null; opening: number; openingDate: string | null; openingPrice?: number | null }): TankErrors {
  const e: TankErrors = {};
  if (t.capacity !== null) {
    if (!(t.capacity > 0)) e.capacity = "ความจุต้องมากกว่า 0 ลิตร";
    else if (!hasAtMostTwoDecimals(t.capacity)) e.capacity = TWO_DECIMALS_MESSAGE;
  }
  if (t.low !== null) {
    if (t.low < 0) e.low = "ใส่ตั้งแต่ 0 ลิตรขึ้นไป";
    else if (!hasAtMostTwoDecimals(t.low)) e.low = TWO_DECIMALS_MESSAGE;
    else if (t.capacity !== null && t.low > t.capacity) e.low = "ค่าเตือนต้องไม่เกินความจุถัง";
  }
  if (!Number.isFinite(t.opening) || t.opening < 0) e.opening = "ใส่ยอดยกมาตั้งแต่ 0 ลิตรขึ้นไป";
  else if (!hasAtMostTwoDecimals(t.opening)) e.opening = TWO_DECIMALS_MESSAGE;
  // brief §14 B8: fuel already in the truck is used up before the first bill, so it needs a price of its own
  const price = t.openingPrice ?? null;
  if (price === null) {
    if (t.opening > 0) e.openingPrice = "ใส่ราคาต่อลิตรของยอดยกมา (น้ำมันส่วนนี้ถูกใช้ก่อนบิลแรก)";
  } else if (!(price > 0)) e.openingPrice = "ราคาต้องมากกว่า 0 บาท";
  else if (!hasAtMostTwoDecimals(price)) e.openingPrice = TWO_DECIMALS_MESSAGE;
  return e;
}

export type UserErrors = { name?: string; email?: string; role?: string; projects?: string; password?: string };
export const ROLES = ["store_admin", "project_viewer", "executive", "system_admin"] as const;
export const MIN_PASSWORD = 8;

export function validateUser(u: { name: string; email: string; role: string; projectIds: string[]; password: string | null }): UserErrors {
  const e: UserErrors = {};
  if (!u.name.trim()) e.name = "ใส่ชื่อ";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email.trim())) e.email = "ใส่อีเมลให้ถูกต้อง";
  if (!(ROLES as readonly string[]).includes(u.role)) e.role = "เลือกบทบาท";
  else if (u.role === "project_viewer" && u.projectIds.length === 0) e.projects = "เลือกโครงการที่ดูแลอย่างน้อย 1 โครงการ";
  if (u.password !== null && u.password.length < MIN_PASSWORD) e.password = `รหัสผ่านอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`;
  return e;
}

/** same limit as a name typed on the driver's phone (BUG-06: a longer code was cut off without a word) */
export const MACHINE_CODE_MAX = 60;

export function validateMachine(m: { code: string }): { code?: string } {
  const code = m.code.trim().replace(/\s+/g, " ");
  if (!code) return { code: "ใส่รหัสหรือทะเบียน" };
  if (code.length > MACHINE_CODE_MAX) return { code: `รหัสหรือทะเบียนยาวได้ไม่เกิน ${MACHINE_CODE_MAX} ตัวอักษร (ตอนนี้ ${code.length} ตัว)` };
  return {};
}

// ───────────── projects (MYOIL keeps its own list since it was split from BookCare, 25 Nov 2026) ─────────────

export type ProjectErrors = { ref?: string; name?: string; code?: string; detail?: string };
export const PROJECT_DETAIL_MAX = 200;
export const PROJECT_REF_MAX = 12;
export const PROJECT_NAME_MAX = 150;
export const PROJECT_CODE_MAX = 30;

/** how a project ref is stored: no spaces, capitals ("pnkk " → "PNKK") */
export const projectRef = (raw: string) => raw.trim().replace(/\s+/g, "").toUpperCase();

export function validateProject(p: { ref: string; name: string; code: string; detail?: string }): ProjectErrors {
  const e: ProjectErrors = {};
  const ref = projectRef(p.ref);
  if (!ref) e.ref = "ใส่รหัสโครงการ เช่น PNKK";
  else if (ref.length < 2 || ref.length > PROJECT_REF_MAX) e.ref = `รหัสโครงการยาว 2 ถึง ${PROJECT_REF_MAX} ตัว (ตอนนี้ ${ref.length} ตัว)`;
  else if (!/^[A-Z0-9-]+$/.test(ref)) e.ref = "รหัสโครงการใช้ได้เฉพาะ A–Z ตัวเลข และขีดกลาง";
  const name = p.name.trim();
  if (!name) e.name = "ใส่ชื่อโครงการ";
  else if (name.length > PROJECT_NAME_MAX) e.name = `ชื่อโครงการยาวได้ไม่เกิน ${PROJECT_NAME_MAX} ตัวอักษร (ตอนนี้ ${name.length} ตัว)`;
  if (p.code.trim().length > PROJECT_CODE_MAX) e.code = `รหัสบัญชียาวได้ไม่เกิน ${PROJECT_CODE_MAX} ตัวอักษร`;
  const detail = (p.detail ?? "").trim();
  if (detail.length > PROJECT_DETAIL_MAX) e.detail = `รายละเอียดไซต์ยาวได้ไม่เกิน ${PROJECT_DETAIL_MAX} ตัวอักษร (ตอนนี้ ${detail.length} ตัว)`;
  return e;
}
