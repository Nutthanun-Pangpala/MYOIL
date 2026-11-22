import { and, asc, count, desc, eq, ilike, isNull, lt, lte, max, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { machineKey } from "@/domain/issue-check";
import { validateCycleDates, validateMachine, validateTank, validateUser, type TankErrors, type UserErrors } from "@/domain/settings-rules";
import { nextCycleAfter } from "@/domain/cycle";
import type { Session } from "@/lib/session";
import { hashSecret } from "@/lib/password";
import { cycleIdFor } from "../cycles/cycle-service";

const { projects, machines, users, userProjects, appSettings, claimCycles, fuelIssues } = schema;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

export type Result<E = Record<string, string>> = { ok: true; message?: string } | { ok: false; message?: string; errors?: E };

// ───────────── projects (read only: BookCare owns them) ─────────────

export async function listProjects(q: string, status: "all" | "open" | "closed") {
  const term = q.trim();
  const rows = await db
    .select({ id: projects.id, ref: projects.refCode, code: projects.projectCode, name: projects.name, active: projects.isActive })
    .from(projects)
    .where(
      and(
        term ? or(ilike(projects.refCode, `%${term}%`), ilike(projects.name, `%${term}%`), ilike(projects.projectCode, `%${term}%`)) : undefined,
        status === "open" ? eq(projects.isActive, true) : status === "closed" ? eq(projects.isActive, false) : undefined,
      ),
    )
    .orderBy(asc(projects.refCode));
  const [{ n }] = await db.select({ n: count() }).from(projects);
  return { rows, total: Number(n) };
}

export async function allProjects() {
  return db.select({ id: projects.id, ref: projects.refCode, name: projects.name, active: projects.isActive }).from(projects).orderBy(asc(projects.refCode));
}

// ───────────── machines ─────────────

export async function listMachines(q: string) {
  const term = q.trim();
  return db
    .select({ id: machines.id, code: machines.code, name: machines.name, type: machines.type, assetCode: machines.assetCode, isRented: machines.isRented })
    .from(machines)
    .where(term ? or(ilike(machines.code, `%${term}%`), ilike(machines.name, `%${term}%`), ilike(machines.assetCode, `%${term}%`)) : undefined)
    .orderBy(asc(machines.code));
}

export type MachineInput = { code: string; name: string; type: string; assetCode: string; isRented: boolean };

export async function saveMachine(id: string | null, m: MachineInput): Promise<Result> {
  const errors: Record<string, string> = { ...validateMachine(m) };
  const key = machineKey(m.code);
  if (!errors.code) {
    const [dup] = await db.select({ id: machines.id, code: machines.code }).from(machines).where(and(eq(machines.key, key), id ? ne(machines.id, id) : undefined)).limit(1);
    if (dup) errors.code = `มีเครื่องจักร “${dup.code}” อยู่แล้ว`;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const values = {
    code: m.code.trim().replace(/\s+/g, " "),
    key,
    name: m.name.trim() || null,
    type: m.type.trim() || null,
    assetCode: m.isRented ? null : m.assetCode.trim() || null,
    isRented: m.isRented,
  };
  if (id) await db.update(machines).set(values).where(eq(machines.id, id));
  else await db.insert(machines).values(values);
  return { ok: true, message: id ? "บันทึกเครื่องจักรแล้ว" : "เพิ่มเครื่องจักรแล้ว" };
}

// ───────────── users ─────────────

export async function listUsers() {
  const us = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active }).from(users).orderBy(desc(users.active), asc(users.name));
  const ups = await db.select({ userId: userProjects.userId, ref: projects.refCode, projectId: projects.id }).from(userProjects).innerJoin(projects, eq(userProjects.projectId, projects.id)).orderBy(asc(projects.refCode));
  return us.map((u) => ({ ...u, projects: ups.filter((p) => p.userId === u.id).map((p) => ({ id: p.projectId, ref: p.ref })) }));
}

export type UserInput = { name: string; email: string; role: string; projectIds: string[]; password: string | null };

export async function createUser(i: UserInput): Promise<Result<UserErrors>> {
  const errors = validateUser(i);
  const email = i.email.trim().toLowerCase();
  if (!errors.email) {
    const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (dup) errors.email = "อีเมลนี้มีผู้ใช้อยู่แล้ว";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ name: i.name.trim(), email, passwordHash: hashSecret(i.password!), role: i.role as never }).returning({ id: users.id });
    if (i.role === "project_viewer") await tx.insert(userProjects).values(i.projectIds.map((projectId) => ({ userId: u.id, projectId })));
  });
  return { ok: true, message: "เพิ่มผู้ใช้แล้ว" };
}

export async function updateUser(me: Session, id: string, i: Omit<UserInput, "password" | "email">): Promise<Result<UserErrors>> {
  const errors = validateUser({ ...i, email: "x@x.xx", password: null });
  if (Object.keys(errors).length) return { ok: false, errors };
  const [cur] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!cur) return { ok: false, message: "ไม่พบผู้ใช้นี้" };
  if (cur.role === "system_admin" && i.role !== "system_admin" && !(await otherActiveAdmin(id))) return { ok: false, message: "ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน" };
  await db.transaction(async (tx) => {
    await tx.update(users).set({ name: i.name.trim(), role: i.role as never }).where(eq(users.id, id));
    await tx.delete(userProjects).where(eq(userProjects.userId, id));
    if (i.role === "project_viewer") await tx.insert(userProjects).values(i.projectIds.map((projectId) => ({ userId: id, projectId })));
  });
  return { ok: true, message: "บันทึกผู้ใช้แล้ว" };
}

async function otherActiveAdmin(exceptId: string) {
  const [r] = await db.select({ n: count() }).from(users).where(and(eq(users.role, "system_admin"), eq(users.active, true), ne(users.id, exceptId)));
  return Number(r.n) > 0;
}

export async function resetPassword(id: string, password: string): Promise<Result<UserErrors>> {
  const errors = validateUser({ name: "x", email: "x@x.xx", role: "store_admin", projectIds: [], password });
  if (errors.password) return { ok: false, errors: { password: errors.password } };
  const r = await db.update(users).set({ passwordHash: hashSecret(password) }).where(eq(users.id, id)).returning({ id: users.id });
  return r.length ? { ok: true, message: "รีเซ็ตรหัสผ่านแล้ว" } : { ok: false, message: "ไม่พบผู้ใช้นี้" };
}

export async function setUserActive(me: Session, id: string, active: boolean): Promise<Result> {
  if (!active && id === me.userId) return { ok: false, message: "ปิดบัญชีของตัวเองไม่ได้" };
  const [cur] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!cur) return { ok: false, message: "ไม่พบผู้ใช้นี้" };
  if (!active && cur.role === "system_admin" && !(await otherActiveAdmin(id))) return { ok: false, message: "ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน" };
  await db.update(users).set({ active }).where(eq(users.id, id));
  return { ok: true, message: active ? "เปิดบัญชีแล้ว" : "ปิดบัญชีแล้ว" };
}

// ───────────── tank ─────────────

export async function loadTank() {
  const [s] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  const [closed] = await db.select({ n: count() }).from(claimCycles).where(eq(claimCycles.status, "closed"));
  return {
    capacity: s?.tankCapacityLiters ?? null,
    low: s?.lowLevelLiters ?? null,
    opening: s?.openingLiters ?? 0,
    openingDate: s?.openingDate ?? null,
    /** the opening balance can be edited until the first cycle is closed */
    openingLocked: Number(closed.n) > 0,
  };
}

export async function saveTank(t: { capacity: number | null; low: number | null; opening: number; openingDate: string | null }): Promise<Result<TankErrors>> {
  const errors = validateTank(t);
  if (Object.keys(errors).length) return { ok: false, errors };
  const cur = await loadTank();
  if (cur.openingLocked && (cur.opening !== t.opening || cur.openingDate !== t.openingDate)) {
    return { ok: false, errors: { opening: "แก้ยอดยกมาไม่ได้แล้ว เพราะปิดรอบไปแล้ว" } };
  }
  const values = { tankCapacityLiters: t.capacity, lowLevelLiters: t.low, openingLiters: t.opening, openingDate: t.openingDate };
  await db.insert(appSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: appSettings.id, set: values });
  return { ok: true, message: "บันทึกค่าของรถเติมน้ำมันแล้ว" };
}

// ───────────── cycles ─────────────

export async function listCyclesForSettings() {
  const cur = await cycleIdFor(db, today());
  // the next cycle is made by the system, so it is already on the list
  const [here] = await db.select().from(claimCycles).where(eq(claimCycles.id, cur)).limit(1);
  await cycleIdFor(db, nextCycleAfter(here.endDate).start);
  const rows = await db.select().from(claimCycles).orderBy(desc(claimCycles.startDate));
  return rows.map((c) => ({ id: c.id, start: c.startDate, end: c.endDate, status: c.status, isCurrent: c.startDate <= today() && today() <= c.endDate, future: c.startDate > today() }));
}

/** change the end (and the start when there is no earlier cycle) of an open cycle; the next cycle's start follows */
export async function updateCycleDates(id: string, start: string, end: string): Promise<Result> {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(claimCycles).where(eq(claimCycles.id, id)).for("update").limit(1);
    if (!c) return { ok: false as const, message: "ไม่พบรอบนี้" };
    if (c.status === "closed") return { ok: false as const, message: "รอบที่ปิดแล้วแก้วันที่ไม่ได้" };
    const [prev] = await tx.select().from(claimCycles).where(lt(claimCycles.startDate, c.startDate)).orderBy(desc(claimCycles.startDate)).limit(1);
    const [next] = await tx.select().from(claimCycles).where(sql`${claimCycles.startDate} > ${c.startDate}`).orderBy(asc(claimCycles.startDate)).limit(1);
    if (next && next.status === "closed") return { ok: false as const, message: "รอบถัดไปปิดแล้ว แก้วันที่ไม่ได้" };
    const bad = validateCycleDates({ prev: prev ? { start: prev.startDate, end: prev.endDate } : null, next: next ? { start: next.startDate, end: next.endDate } : null, start, end });
    if (bad) return { ok: false as const, message: bad };

    if (start !== c.startDate && !prev) return { ok: false as const, message: "แก้วันเริ่มของรอบแรกไม่ได้ ให้แก้วันสิ้นสุดแทน" };
    // slips dated in days that would change hands would sit in the wrong cycle: refuse and say so
    const moved: { from: string; to: string }[] = [];
    if (end < c.endDate) moved.push({ from: end, to: c.endDate }); // days leave this cycle
    if (end > c.endDate && next) moved.push({ from: c.endDate, to: end }); // days leave the next cycle
    const [hit] = await tx
      .select({ n: count() })
      .from(fuelIssues)
      .where(
        and(
          isNull(fuelIssues.cancelledAt),
          or(
            ...moved.map((m) => and(sql`${fuelIssues.issueDate} > ${m.from}`, lte(fuelIssues.issueDate, m.to))),
            sql`false`,
          ),
        ),
      );
    if (Number(hit.n) > 0) return { ok: false as const, message: `มีใบจ่าย ${hit.n} ใบลงวันที่ในช่วงวันที่จะย้ายไปอีกรอบ ย้ายวันที่ของรอบไม่ได้` };

    await tx.update(claimCycles).set({ startDate: start, endDate: end }).where(eq(claimCycles.id, id));
    if (next) {
      const ns = new Date(Date.parse(`${end}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      await tx.update(claimCycles).set({ startDate: ns }).where(eq(claimCycles.id, next.id));
    }
    return { ok: true as const, message: "บันทึกวันที่ของรอบแล้ว" };
  });
}

// ───────────── project sync (from BookCare) ─────────────

export async function lastProjectSync(): Promise<Date | null> {
  const [r] = await db.select({ at: max(projects.syncedAt) }).from(projects);
  return r?.at ?? null;
}
