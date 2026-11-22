"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/lib/session";
import { BookcareProjectSource, bookcareConfigured, ProjectSourceError } from "@/server/projects/bookcare-source";
import { syncProjects } from "@/server/projects/sync-projects";
import { createUser, resetPassword, saveMachine, saveTank, setUserActive, updateCycleDates, updateUser } from "@/server/settings/settings-service";

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const s = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ids = (v: unknown) => (Array.isArray(v) ? v.filter(isId).slice(0, 200) : []);
const bad = { ok: false as const, message: "ข้อมูลไม่ถูกต้อง" };
const done = <T extends { ok: boolean }>(r: T, path: string) => {
  if (r.ok) revalidatePath(path);
  return r;
};

export async function saveMachineAction(id: string | null, raw: unknown) {
  await requireAdministrator();
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (id !== null && !isId(id)) return bad;
  return done(await saveMachine(id, { code: s(r.code, 100), name: s(r.name, 100), type: s(r.type, 50), assetCode: s(r.assetCode, 50), isRented: r.isRented === true }), "/settings/machines");
}

export async function createUserAction(raw: unknown) {
  await requireAdministrator();
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return done(await createUser({ name: s(r.name, 100), email: s(r.email, 200), role: s(r.role, 30), projectIds: ids(r.projectIds), password: s(r.password, 100) }), "/settings/users");
}

export async function updateUserAction(id: string, raw: unknown) {
  const me = await requireAdministrator();
  if (!isId(id)) return bad;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return done(await updateUser(me, id, { name: s(r.name, 100), role: s(r.role, 30), projectIds: ids(r.projectIds) }), "/settings/users");
}

export async function resetPasswordAction(id: string, password: string) {
  await requireAdministrator();
  if (!isId(id)) return bad;
  return done(await resetPassword(id, s(password, 100)), "/settings/users");
}

export async function setUserActiveAction(id: string, active: boolean) {
  const me = await requireAdministrator();
  if (!isId(id)) return bad;
  return done(await setUserActive(me, id, active === true), "/settings/users");
}

export async function saveTankAction(raw: unknown) {
  await requireAdministrator();
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const date = typeof r.openingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.openingDate) ? r.openingDate : null;
  const res = await saveTank({ capacity: n(r.capacity), low: n(r.low), opening: n(r.opening) ?? 0, openingDate: date });
  if (res.ok) {
    revalidatePath("/settings/tank");
    revalidatePath("/", "layout");
  }
  return res;
}

export async function updateCycleDatesAction(id: string, start: string, end: string) {
  await requireAdministrator();
  if (!isId(id)) return bad;
  const res = await updateCycleDates(id, s(start, 10), s(end, 10));
  if (res.ok) {
    revalidatePath("/settings/cycles");
    revalidatePath("/invoices");
  }
  return res;
}

/** pull the project list from BookCare (read-only role) — the only way `projects` changes besides the seed */
export async function syncProjectsAction(): Promise<{ ok: boolean; message: string }> {
  await requireAdministrator();
  if (!bookcareConfigured()) return { ok: false, message: "ยังไม่ได้เชื่อมต่อ BookCare (ยังไม่ได้ตั้ง BOOKCARE_DATABASE_URL)" };
  try {
    const r = await syncProjects(new BookcareProjectSource());
    revalidatePath("/settings/projects");
    return { ok: true, message: `ซิงก์แล้ว ${r.upserted} โครงการ` + (r.deactivated ? ` ปิด ${r.deactivated} โครงการที่ไม่มีใน BookCare แล้ว` : "") };
  } catch (e) {
    return { ok: false, message: e instanceof ProjectSourceError ? e.message : "ซิงก์ไม่สำเร็จ ลองอีกครั้ง" };
  }
}
