import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { cycleContaining, dayAfter, dayBefore, planClose, reopenReasonError, nextInvoiceStatus, type InvoiceStatus } from "@/domain/cycle";
import { sumAmounts, sumLiters } from "@/domain/money";
import { thaiMonthShort } from "@/domain/thai-date";
import type { Session } from "@/lib/session";
import { visibleProjectIds } from "../projects/project-scope";
import { billableSql } from "../issues/billable";

const { claimCycles, cycleEvents, fuelIssues, fuelIssueLines, invoices, machines, projects, users } = schema;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = Tx | typeof db;

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

// ───────────── cycles ─────────────

/** the cycle that covers `date`; makes the calendar-month one when none exists (no gaps, no overlaps) */
/** the cut day of every month from settings (1–28), null = the calendar month */
export async function cutDay(tx: Db = db): Promise<number | null> {
  const [s] = await tx.select({ d: schema.appSettings.cycleCutDay }).from(schema.appSettings).where(eq(schema.appSettings.id, 1)).limit(1);
  return s?.d ?? null;
}

/**
 * The cycle a date belongs to. When there is none yet it is made from the cut day, trimmed so it never
 * overlaps a cycle that already exists on either side (someone may have changed a cycle's dates by hand).
 */
export async function cycleIdFor(tx: Db, date: string): Promise<string> {
  const find = async () => {
    const [c] = await tx
      .select({ id: claimCycles.id })
      .from(claimCycles)
      .where(and(lte(claimCycles.startDate, date), gte(claimCycles.endDate, date)))
      .limit(1);
    return c?.id;
  };
  const have = await find();
  if (have) return have;
  const m = cycleContaining(date, await cutDay(tx));
  const [before] = await tx.select({ end: claimCycles.endDate }).from(claimCycles).where(lt(claimCycles.endDate, date)).orderBy(desc(claimCycles.endDate)).limit(1);
  const [after] = await tx.select({ start: claimCycles.startDate }).from(claimCycles).where(gt(claimCycles.startDate, date)).orderBy(asc(claimCycles.startDate)).limit(1);
  const start = before && before.end >= m.start ? dayAfter(before.end) : m.start;
  const end = after && after.start <= m.end ? dayBefore(after.start) : m.end;
  await tx.insert(claimCycles).values({ startDate: start, endDate: end }).onConflictDoNothing({ target: claimCycles.startDate });
  return (await find())!;
}

export type CycleRow = { id: string; start: string; end: string; status: "open" | "closed"; closedAt: Date | null; closedByName: string | null };

/** newest first; always includes the cycle of today */
export async function listCycles(): Promise<CycleRow[]> {
  await cycleIdFor(db, today());
  const rows = await db
    .select({ id: claimCycles.id, start: claimCycles.startDate, end: claimCycles.endDate, status: claimCycles.status, closedAt: claimCycles.closedAt, closedByName: users.name })
    .from(claimCycles)
    .leftJoin(users, eq(claimCycles.closedBy, users.id))
    .orderBy(desc(claimCycles.startDate));
  return rows;
}

export const cycleLabel = (c: { start: string }) => thaiMonthShort(c.start);

export type CycleEvent = { action: "close" | "reopen"; reason: string | null; at: Date; userName: string | null };
export async function cycleEventsOf(cycleId: string): Promise<CycleEvent[]> {
  return db
    .select({ action: cycleEvents.action, reason: cycleEvents.reason, at: cycleEvents.at, userName: users.name })
    .from(cycleEvents)
    .leftJoin(users, eq(cycleEvents.userId, users.id))
    .where(eq(cycleEvents.cycleId, cycleId))
    .orderBy(desc(cycleEvents.at));
}

// ───────────── what a cycle's invoices hold ─────────────

export type InvoiceSummary = {
  projectId: string;
  projectRef: string;
  projectName: string;
  slips: number;
  liters: number;
  amount: number;
  /** a signed slip with no price yet: the amount is not complete */
  pendingPrice: number;
  status: InvoiceStatus;
  unsignedSlips: number;
  unsignedLiters: number;
};

export type CycleView = {
  cycle: CycleRow;
  rows: InvoiceSummary[];
  totals: { projects: number; slips: number; liters: number; amount: number };
  unsigned: { slips: number; liters: number; projects: number };
  /** signed phone slips nobody has checked yet: not invoiced, carried to the next cycle if the cycle closes now */
  waitingCheck: { slips: number; liters: number };
  /** every live slip of the cycle (signed or not) — what the monthly table shows for these slips */
  allLiters: number;
  carriedIn: { slips: number; liters: number };
};

/** slips of a cycle with their lines, scoped to what this person may see */
async function slipsOfCycle(session: Session, cycleId: string, onlyProject?: string) {
  const scope = await visibleProjectIds(session);
  if (scope && scope.length === 0) return [];
  const heads = await db
    .select({
      id: fuelIssues.id,
      projectId: fuelIssues.projectId,
      issueDate: fuelIssues.issueDate,
      bookNo: fuelIssues.bookNo,
      docNo: fuelIssues.docNo,
      signed: billableSql,
      receivedSigned: fuelIssues.receivedSigned,
    })
    .from(fuelIssues)
    .where(
      and(
        eq(fuelIssues.claimCycleId, cycleId),
        isNull(fuelIssues.cancelledAt),
        scope ? inArray(fuelIssues.projectId, scope) : undefined,
        onlyProject ? eq(fuelIssues.projectId, onlyProject) : undefined,
      ),
    )
    .orderBy(asc(fuelIssues.issueDate), asc(fuelIssues.bookNo), asc(fuelIssues.docNo));
  if (heads.length === 0) return [];
  const lines = await db
    .select({ issueId: fuelIssueLines.issueId, machine: machines.code, liters: fuelIssueLines.liters, price: fuelIssueLines.pricePerLiter, amount: fuelIssueLines.amount })
    .from(fuelIssueLines)
    .innerJoin(machines, eq(fuelIssueLines.machineId, machines.id))
    .where(inArray(fuelIssueLines.issueId, heads.map((h) => h.id)))
    .orderBy(asc(fuelIssueLines.issueId), asc(fuelIssueLines.position));
  const by = new Map<string, typeof lines>();
  for (const l of lines) (by.get(l.issueId) ?? by.set(l.issueId, []).get(l.issueId)!).push(l);
  return heads.map((h) => ({ ...h, lines: by.get(h.id) ?? [] }));
}

export async function loadCycleView(session: Session, cycleId: string): Promise<CycleView | null> {
  const [c] = await db
    .select({ id: claimCycles.id, start: claimCycles.startDate, end: claimCycles.endDate, status: claimCycles.status, closedAt: claimCycles.closedAt, closedByName: users.name })
    .from(claimCycles)
    .leftJoin(users, eq(claimCycles.closedBy, users.id))
    .where(eq(claimCycles.id, cycleId))
    .limit(1);
  if (!c) return null;

  const slips = await slipsOfCycle(session, cycleId);
  const proj = await db.select({ id: projects.id, ref: projects.refCode, name: projects.name }).from(projects);
  const pmap = new Map(proj.map((p) => [p.id, p]));
  const statuses = new Map((await db.select({ projectId: invoices.projectId, status: invoices.status }).from(invoices).where(eq(invoices.cycleId, cycleId))).map((i) => [i.projectId, i.status]));

  const waitingCheck = { slips: 0, liters: 0 };
  const byProject = new Map<string, InvoiceSummary>();
  for (const s of slips) {
    const p = pmap.get(s.projectId)!;
    const r =
      byProject.get(s.projectId) ??
      byProject.set(s.projectId, {
        projectId: s.projectId,
        projectRef: p.ref,
        projectName: p.name,
        slips: 0,
        liters: 0,
        amount: 0,
        pendingPrice: 0,
        status: statuses.get(s.projectId) ?? "draft",
        unsignedSlips: 0,
        unsignedLiters: 0,
      }).get(s.projectId)!;
    const liters = sumLiters(s.lines.map((l) => l.liters));
    if (!s.signed && s.receivedSigned) {
      waitingCheck.slips += 1;
      waitingCheck.liters = sumLiters([waitingCheck.liters, liters]);
      continue;
    }
    if (!s.signed) {
      r.unsignedSlips += 1;
      r.unsignedLiters = sumLiters([r.unsignedLiters, liters]);
      continue;
    }
    r.slips += 1;
    r.liters = sumLiters([r.liters, liters]);
    r.amount = sumAmounts([r.amount, ...s.lines.map((l) => l.amount ?? 0)]);
    if (s.lines.some((l) => l.amount === null)) r.pendingPrice += 1;
  }
  // a project with only unsigned slips still shows, so it is not forgotten
  const rows = [...byProject.values()].sort((a, b) => a.projectRef.localeCompare(b.projectRef, "en"));

  const unsignedRows = rows.filter((r) => r.unsignedSlips > 0);
  const allLiters = sumLiters(slips.map((s) => sumLiters(s.lines.map((l) => l.liters))));
  const invoiced = rows.filter((r) => r.slips > 0);
  return {
    cycle: c,
    rows,
    totals: {
      projects: invoiced.length,
      slips: invoiced.reduce((n, r) => n + r.slips, 0),
      liters: sumLiters(invoiced.map((r) => r.liters)),
      amount: sumAmounts(invoiced.map((r) => r.amount)),
    },
    unsigned: {
      slips: unsignedRows.reduce((n, r) => n + r.unsignedSlips, 0),
      liters: sumLiters(unsignedRows.map((r) => r.unsignedLiters)),
      projects: unsignedRows.length,
    },
    waitingCheck,
    allLiters,
    carriedIn: { slips: 0, liters: 0 },
  };
}

// ───────────── one project's invoice ─────────────

export type InvoiceLine = { slipId: string; date: string; bookNo: string; docNo: string; machines: string; price: number | null; liters: number; amount: number | null };
export type InvoiceDetail = {
  cycle: CycleRow;
  /** code = accounting code (projects.project_code), printed after the ref on the form */
  project: { id: string; ref: string; name: string; code: string | null };
  status: InvoiceStatus;
  totalRowCode: string;
  lines: InvoiceLine[];
  liters: number;
  amount: number;
  pendingPrice: boolean;
  unsigned: { slips: number; liters: number };
};

export async function loadInvoice(session: Session, cycleId: string, projectId: string): Promise<InvoiceDetail | null> {
  const view = await loadCycleView(session, cycleId);
  if (!view) return null;
  const scope = await visibleProjectIds(session);
  if (scope && !scope.includes(projectId)) return null;
  const [p] = await db.select({ id: projects.id, ref: projects.refCode, name: projects.name, code: projects.projectCode }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return null;
  const slips = await slipsOfCycle(session, cycleId, projectId);
  const signed = slips.filter((s) => s.signed);
  const lines: InvoiceLine[] = signed.map((s) => {
    const priced = s.lines.filter((l) => l.price !== null);
    const liters = sumLiters(s.lines.map((l) => l.liters));
    const complete = priced.length === s.lines.length;
    return {
      slipId: s.id,
      date: s.issueDate,
      bookNo: s.bookNo,
      docNo: s.docNo,
      machines: s.lines.map((l) => l.machine).join("+"),
      price: priced[0]?.price ?? null,
      liters,
      amount: complete ? sumAmounts(s.lines.map((l) => l.amount ?? 0)) : null,
    };
  });
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.cycleId, cycleId), eq(invoices.projectId, projectId))).limit(1);
  const unsigned = slips.filter((s) => !s.signed);
  return {
    cycle: view.cycle,
    project: p,
    status: inv?.status ?? "draft",
    totalRowCode: inv?.totalRowCode ?? "",
    lines,
    liters: sumLiters(lines.map((l) => l.liters)),
    amount: sumAmounts(lines.map((l) => l.amount ?? 0)),
    pendingPrice: lines.some((l) => l.amount === null),
    unsigned: { slips: unsigned.length, liters: sumLiters(unsigned.map((s) => sumLiters(s.lines.map((l) => l.liters)))) },
  };
}

// ───────────── close · reopen ─────────────

export type CycleResult = { ok: true; carried?: { slips: number; liters: number } } | { ok: false; message: string };

export async function closeCycle(session: Session, cycleId: string): Promise<CycleResult> {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(claimCycles).where(eq(claimCycles.id, cycleId)).for("update").limit(1);
    if (!c) return { ok: false as const, message: "ไม่พบรอบนี้" };
    if (c.status === "closed") return { ok: false as const, message: "รอบนี้ปิดแล้ว" };

    const heads = await tx
      .select({ id: fuelIssues.id, projectId: fuelIssues.projectId, signed: billableSql, cancelled: fuelIssues.cancelledAt })
      .from(fuelIssues)
      .where(eq(fuelIssues.claimCycleId, cycleId));
    const lines = heads.length
      ? await tx.select({ issueId: fuelIssueLines.issueId, liters: fuelIssueLines.liters, amount: fuelIssueLines.amount }).from(fuelIssueLines).where(inArray(fuelIssueLines.issueId, heads.map((h) => h.id)))
      : [];
    // OBS-13: a signed slip with no price cannot be billed, and is not carried over: the admin sets the day's price first
    const signedIds = new Set(heads.filter((h) => h.signed && !h.cancelled).map((h) => h.id));
    const unpriced = new Set(lines.filter((l) => signedIds.has(l.issueId) && l.amount === null).map((l) => l.issueId));
    if (unpriced.size > 0) {
      return { ok: false as const, message: `ปิดรอบไม่ได้ มีใบที่เซ็นรับแล้วแต่ยังไม่มีราคา ${unpriced.size} ใบ บันทึกบิลซื้อที่ลงวันที่ไม่เกินวันที่ในใบก่อน แล้วค่อยปิดรอบ` };
    }
    const litersOf = (id: string) => sumLiters(lines.filter((l) => l.issueId === id).map((l) => l.liters));
    const plan = planClose(heads.map((h) => ({ id: h.id, signed: h.signed, cancelled: h.cancelled !== null, liters: litersOf(h.id) })));

    // the next cycle follows without gap or overlap
    // (the cycle that holds the day after this one's end; it is made from the cut day when it is not there yet)
    const nextId = await cycleIdFor(tx, dayAfter(c.endDate));
    if (plan.carryIds.length) await tx.update(fuelIssues).set({ claimCycleId: nextId }).where(inArray(fuelIssues.id, plan.carryIds));

    // an invoice row for every project that has signed slips (status starts as draft)
    const signedProjects = [...new Set(heads.filter((h) => h.signed && !h.cancelled).map((h) => h.projectId))];
    for (const projectId of signedProjects) {
      await tx.insert(invoices).values({ cycleId, projectId }).onConflictDoNothing({ target: [invoices.cycleId, invoices.projectId] });
    }

    await tx.update(claimCycles).set({ status: "closed", closedAt: new Date(), closedBy: session.userId }).where(eq(claimCycles.id, cycleId));
    await tx.insert(cycleEvents).values({
      cycleId,
      action: "close",
      reason: plan.carryIds.length ? `ยกไปรอบถัดไป ${plan.carryIds.length} ใบ ${plan.carryLiters} ลิตร` : null,
      userId: session.userId,
    });
    return { ok: true as const, carried: { slips: plan.carryIds.length, liters: plan.carryLiters } };
  });
}

export async function reopenCycle(session: Session, cycleId: string, reason: string): Promise<CycleResult> {
  const err = reopenReasonError(reason);
  if (err) return { ok: false, message: err };
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(claimCycles).where(eq(claimCycles.id, cycleId)).for("update").limit(1);
    if (!c) return { ok: false as const, message: "ไม่พบรอบนี้" };
    if (c.status !== "closed") return { ok: false as const, message: "รอบนี้ยังไม่ได้ปิด" };
    await tx.update(claimCycles).set({ status: "open", closedAt: null, closedBy: null }).where(eq(claimCycles.id, cycleId));
    // every invoice of the cycle goes back to draft: it has to be issued and signed again
    await tx.update(invoices).set({ status: "draft", statusChangedAt: new Date() }).where(eq(invoices.cycleId, cycleId));
    await tx.insert(cycleEvents).values({ cycleId, action: "reopen", reason: reason.trim().slice(0, 300), userId: session.userId });
    return { ok: true as const };
  });
}

// ───────────── invoice status and code ─────────────

async function closedCycle(cycleId: string) {
  const [c] = await db.select({ status: claimCycles.status }).from(claimCycles).where(eq(claimCycles.id, cycleId)).limit(1);
  return c?.status === "closed";
}

/** one step forward; only after the cycle is closed */
export async function advanceInvoice(session: Session, cycleId: string, projectId: string): Promise<CycleResult> {
  const scope = await visibleProjectIds(session);
  if (scope && !scope.includes(projectId)) return { ok: false, message: "ไม่พบใบแจ้งนี้" };
  if (!(await closedCycle(cycleId))) return { ok: false, message: "เปลี่ยนสถานะได้หลังปิดรอบ" };
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.cycleId, cycleId), eq(invoices.projectId, projectId))).limit(1);
  if (!inv) return { ok: false, message: "รอบนี้ไม่มีใบแจ้งของโครงการนี้" };
  const next = nextInvoiceStatus(inv.status);
  if (!next) return { ok: false, message: "ใบนี้ส่งบัญชีแล้ว" };
  await db.update(invoices).set({ status: next, statusChangedAt: new Date() }).where(eq(invoices.id, inv.id));
  return { ok: true };
}

export async function saveInvoiceCode(session: Session, cycleId: string, projectId: string, code: string): Promise<CycleResult> {
  const scope = await visibleProjectIds(session);
  if (scope && !scope.includes(projectId)) return { ok: false, message: "ไม่พบใบแจ้งนี้" };
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.cycleId, cycleId), eq(invoices.projectId, projectId))).limit(1);
  if (inv && inv.status !== "draft") return { ok: false, message: "แก้รหัสได้ขณะใบแจ้งยังเป็นร่าง" };
  const value = code.trim().slice(0, 50) || null;
  if (inv) await db.update(invoices).set({ totalRowCode: value }).where(eq(invoices.id, inv.id));
  else await db.insert(invoices).values({ cycleId, projectId, totalRowCode: value });
  return { ok: true };
}
