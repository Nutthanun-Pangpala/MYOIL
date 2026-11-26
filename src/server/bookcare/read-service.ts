import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays } from "@/domain/iso-date";
import { sumLiters } from "@/domain/money";
import { stockOn, tankCapacity } from "../ledger/ledger-service";

const { fuelIssues, fuelIssueLines, fuelPurchases, machines, projects } = schema;

export const WINDOW_DAYS = 90;
/** fewer fills than this in the window → no "usual" size to compare with, so maxLiters is null (the phone does not warn) */
export const MIN_FILLS_FOR_MAX = 3;
const num = (n: number) => String(n);

// ───────────── API 4: machines ─────────────

export type MachineRow = { id: string; code: string; name: string | null; isRented: boolean; projects: string[]; maxLiters: string | null; lastFilledAt: string | null };

/** every machine the phone may offer. Names still "รอตรวจชื่อ" are held back until an admin accepts them. */
export async function machinesForPhone(today: string): Promise<MachineRow[]> {
  const from = addDays(today, -WINDOW_DAYS);
  const all = await db
    .select({ id: machines.id, code: machines.code, name: machines.name, isRented: machines.isRented })
    .from(machines)
    .where(and(eq(machines.pendingReview, false), isNull(machines.deletedAt)))
    .orderBy(machines.code);
  const used = await db
    .select({
      machineId: fuelIssueLines.machineId,
      ref: projects.refCode,
      maxLiters: sql<number>`max(${fuelIssueLines.liters})::float8`,
      fills: sql<number>`count(*)::int`,
      last: sql<string>`max(${fuelIssues.issueDate})::text`,
    })
    .from(fuelIssueLines)
    .innerJoin(fuelIssues, eq(fuelIssues.id, fuelIssueLines.issueId))
    .innerJoin(projects, eq(projects.id, fuelIssues.projectId))
    .where(and(isNull(fuelIssues.cancelledAt), gte(fuelIssues.issueDate, from)))
    .groupBy(fuelIssueLines.machineId, projects.refCode);

  const byMachine = new Map<string, { projects: string[]; max: number; fills: number; last: string }>();
  for (const u of used) {
    const cur = byMachine.get(u.machineId) ?? { projects: [], max: 0, fills: 0, last: "" };
    cur.projects.push(u.ref);
    cur.max = Math.max(cur.max, u.maxLiters);
    cur.fills += u.fills;
    if (u.last > cur.last) cur.last = u.last;
    byMachine.set(u.machineId, cur);
  }
  return all.map((m) => {
    const u = byMachine.get(m.id);
    return { ...m, projects: u ? u.projects.sort() : [], maxLiters: u && u.fills >= MIN_FILLS_FOR_MAX ? num(u.max) : null, lastFilledAt: u ? u.last : null };
  });
}

// ───────────── API 5: tank ─────────────

export type TankAnswer = { liters: string; asOf: string; capacity: string | null; today: { issues: number; litersOut: string }; includedRefs: string[] };

/** 2026-11-23T09:58:00+07:00 — Bangkok clock, as the contract writes times */
export const bangkokStamp = (d: Date) => `${new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 19)}+07:00`;

export async function tankNow(today: string, now = new Date()): Promise<TankAnswer> {
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const [stock, capacity, issues, buys, todays] = await Promise.all([
    stockOn(today),
    tankCapacity(),
    db.select({ ref: fuelIssues.externalRef }).from(fuelIssues).where(and(eq(fuelIssues.source, "mobile"), isNull(fuelIssues.cancelledAt), gte(fuelIssues.receivedAt, since))),
    db.select({ ref: fuelPurchases.externalRef }).from(fuelPurchases).where(and(eq(fuelPurchases.source, "mobile"), isNull(fuelPurchases.cancelledAt), gte(fuelPurchases.createdAt, since))),
    db
      .select({ issueId: fuelIssueLines.issueId, liters: fuelIssueLines.liters })
      .from(fuelIssueLines)
      .innerJoin(fuelIssues, eq(fuelIssues.id, fuelIssueLines.issueId))
      .where(and(isNull(fuelIssues.cancelledAt), eq(fuelIssues.issueDate, today))),
  ]);
  return {
    liters: num(stock.liters),
    asOf: bangkokStamp(now),
    capacity: capacity === null ? null : num(capacity),
    today: { issues: new Set(todays.map((t) => t.issueId)).size, litersOut: num(sumLiters(todays.map((t) => t.liters))) },
    includedRefs: [...issues, ...buys].map((r) => r.ref).filter((r): r is string => !!r),
  };
}

// ───────────── API 6: status of sent slips ─────────────

export const MAX_STATUS_REFS = 50;

export type IssueStatusRow = {
  ref: string;
  bookNo: string;
  docNo: string;
  review: "pending_review" | "checked";
  signed: boolean;
  /** signed through API 3 after the slip was sent (the office's "เซ็นรับทีหลัง" tag) */
  signedLate: boolean;
  cancelled: boolean;
  editedAfterSign: boolean;
  lines: { position: number; machineId: string; machineCode: string; liters: string; hourMeter: string | null }[];
};

export async function issueStatuses(refs: string[]): Promise<{ issues: IssueStatusRow[]; unknownRefs: string[] }> {
  if (refs.length === 0) return { issues: [], unknownRefs: [] };
  const heads = await db.select().from(fuelIssues).where(inArray(fuelIssues.externalRef, refs));
  const lines = heads.length
    ? await db
        .select({ issueId: fuelIssueLines.issueId, position: fuelIssueLines.position, machineId: fuelIssueLines.machineId, code: machines.code, liters: fuelIssueLines.liters, hourMeter: fuelIssueLines.hourMeter })
        .from(fuelIssueLines)
        .innerJoin(machines, eq(machines.id, fuelIssueLines.machineId))
        .where(inArray(fuelIssueLines.issueId, heads.map((h) => h.id)))
        .orderBy(fuelIssueLines.position)
    : [];
  const issues = heads.map((h) => ({
    ref: h.externalRef!,
    bookNo: h.bookNo,
    docNo: h.docNo,
    review: h.reviewStatus as IssueStatusRow["review"],
    signed: h.receivedSigned,
    signedLate: h.receivedSigned && h.signatureRef !== null,
    cancelled: h.cancelledAt !== null,
    editedAfterSign: h.editedAfterSign,
    lines: lines
      .filter((l) => l.issueId === h.id)
      .map((l) => ({ position: l.position, machineId: l.machineId, machineCode: l.code, liters: num(l.liters), hourMeter: l.hourMeter === null ? null : num(l.hourMeter) })),
  }));
  const known = new Set(issues.map((i) => i.ref));
  return { issues, unknownRefs: refs.filter((r) => !known.has(r)) };
}

/** `?refs=a,b` → unique UUIDs, or an error message */
export function parseRefs(q: string | null): { ok: true; refs: string[] } | { ok: false; message: string } {
  const refs = [...new Set((q ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
  if (refs.length === 0) return { ok: false, message: "ต้องมี refs อย่างน้อย 1 รายการ" };
  if (refs.length > MAX_STATUS_REFS) return { ok: false, message: `ถามได้ไม่เกิน ${MAX_STATUS_REFS} ref ต่อคำขอ` };
  if (refs.some((r) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r))) return { ok: false, message: "ref ต้องเป็น UUID" };
  return { ok: true, refs };
}
