import { and, asc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Session } from "@/lib/session";
import { sumLiters } from "@/domain/money";
import { visibleProjectIds } from "../projects/project-scope";
import { getIssueForEdit, loadForChange, updateIssue, type ChangeResult } from "./issue-service";
import { withDateFlags } from "@/domain/bookcare-flags";

const { fuelIssues, fuelIssueLines, fuelIssueLinePhotos, fuelIssueAudit, machines, projects, users } = schema;

export type ReviewLine = {
  lineId: string;
  position: number;
  machineId: string;
  machine: string;
  machinePending: boolean;
  liters: number;
  hourMeter: number | null;
  hasPhoto: boolean;
  photoTakenAt: string | null;
};

export type ReviewInfo = {
  status: "pending_review" | "checked";
  flags: string[];
  confirmedWarnings: string[];
  driverName: string | null;
  recordedAt: string | null;
  receivedAt: string | null;
  unsignedReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  editedAfterSign: boolean;
  lines: ReviewLine[];
  /** names an admin may fold a held machine into */
  knownMachines: { id: string; code: string }[];
};

/** null for a slip keyed by the office: nothing to check */
export async function getReview(issueId: string): Promise<ReviewInfo | null> {
  const [h] = await db
    .select({ i: fuelIssues, reviewer: users.name })
    .from(fuelIssues)
    .leftJoin(users, eq(users.id, fuelIssues.reviewedBy))
    .where(eq(fuelIssues.id, issueId))
    .limit(1);
  if (!h || h.i.source !== "mobile") return null;
  const lines = await db
    .select({
      lineId: fuelIssueLines.id,
      position: fuelIssueLines.position,
      machineId: machines.id,
      machine: machines.code,
      machinePending: machines.pendingReview,
      liters: fuelIssueLines.liters,
      hourMeter: fuelIssueLines.hourMeter,
      photoLine: fuelIssueLinePhotos.lineId,
      photoTakenAt: fuelIssueLinePhotos.takenAt,
    })
    .from(fuelIssueLines)
    .innerJoin(machines, eq(machines.id, fuelIssueLines.machineId))
    .leftJoin(fuelIssueLinePhotos, eq(fuelIssueLinePhotos.lineId, fuelIssueLines.id))
    .where(eq(fuelIssueLines.issueId, issueId))
    .orderBy(asc(fuelIssueLines.position));
  const anyHeld = lines.some((l) => l.machinePending);
  const known = anyHeld ? await db.select({ id: machines.id, code: machines.code }).from(machines).where(and(eq(machines.pendingReview, false), isNull(machines.deletedAt))).orderBy(asc(machines.code)) : [];
  return {
    status: h.i.reviewStatus as ReviewInfo["status"],
    flags: withDateFlags(h.i.flags, h.i.issueDate, h.i.receivedAt?.toISOString() ?? null),
    confirmedWarnings: h.i.confirmedWarnings,
    driverName: h.i.fuelDriver,
    recordedAt: h.i.recordedAt?.toISOString() ?? null,
    receivedAt: h.i.receivedAt?.toISOString() ?? null,
    unsignedReason: h.i.unsignedReason,
    reviewedBy: h.reviewer,
    reviewedAt: h.i.reviewedAt?.toISOString() ?? null,
    editedAfterSign: h.i.editedAfterSign,
    lines: lines.map((l) => ({ lineId: l.lineId, position: l.position, machineId: l.machineId, machine: l.machine, machinePending: l.machinePending, liters: l.liters, hourMeter: l.hourMeter, hasPhoto: l.photoLine !== null, photoTakenAt: l.photoTakenAt?.toISOString() ?? null })),
    knownMachines: known,
  };
}

/** "ตรวจแล้ว": meter photos were compared with the liters. Not allowed while a machine name is still held. */
export async function markChecked(session: Session, id: string): Promise<ChangeResult> {
  const cur = await loadForChange(session, id);
  if (!cur) return { ok: false, message: "ไม่พบใบนี้" };
  if (cur.head.source !== "mobile") return { ok: false, message: "ใบนี้คีย์จากกระดาษ ไม่ต้องตรวจ" };
  if (cur.lock) return { ok: false, message: cur.lock };
  if (cur.head.reviewStatus === "checked") return { ok: true };
  // BA, 26 Nov 2026: a slip dated after the day it arrived counts nowhere until its date is put right — so it cannot be passed either
  if (withDateFlags([], cur.head.issueDate, cur.head.receivedAt?.toISOString() ?? null).includes("dated_ahead")) {
    return { ok: false, message: "ใบนี้ลงวันที่ล่วงหน้า (หลังวันที่ส่งถึง MYOIL) กด “แก้ไข” แล้วแก้วันที่ให้ถูกก่อน จึงกดตรวจแล้วได้" };
  }
  const held = await db
    .select({ id: machines.id })
    .from(fuelIssueLines)
    .innerJoin(machines, eq(machines.id, fuelIssueLines.machineId))
    .where(and(eq(fuelIssueLines.issueId, id), eq(machines.pendingReview, true)))
    .limit(1);
  if (held.length) return { ok: false, message: "มีชื่อเครื่องจักรที่ยังรอตรวจ เลือก “รวมกับเครื่องเดิม” หรือ “รับเป็นเครื่องใหม่” ก่อน" };
  await db.transaction(async (tx) => {
    await tx.update(fuelIssues).set({ reviewStatus: "checked", reviewedBy: session.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(fuelIssues.id, id));
    await tx.insert(fuelIssueAudit).values({ issueId: id, userId: session.userId, action: "update", changes: { review: ["รอตรวจ", "ตรวจแล้ว"] } });
  });
  return { ok: true };
}

/** the held name is a real new machine */
export async function acceptMachine(session: Session, issueId: string, machineId: string): Promise<ChangeResult> {
  const cur = await loadForChange(session, issueId);
  if (!cur) return { ok: false, message: "ไม่พบใบนี้" };
  const [m] = await db.update(machines).set({ pendingReview: false }).where(and(eq(machines.id, machineId), eq(machines.pendingReview, true))).returning({ code: machines.code });
  if (!m) return { ok: false, message: "เครื่องจักรนี้ไม่ได้รอตรวจแล้ว" };
  await db.insert(fuelIssueAudit).values({ issueId, userId: session.userId, action: "update", changes: { machine: [`${m.code} (รอตรวจชื่อ)`, `${m.code} (รับเป็นเครื่องใหม่)`] } });
  return { ok: true };
}

/** the held name is a typo / another spelling of a machine we already have: every line that used it moves over */
export async function mergeMachine(session: Session, issueId: string, heldId: string, intoId: string): Promise<ChangeResult> {
  const cur = await loadForChange(session, issueId);
  if (!cur) return { ok: false, message: "ไม่พบใบนี้" };
  if (heldId === intoId) return { ok: false, message: "เลือกเครื่องเดิมที่ต้องการรวมเข้าด้วย" };
  return db.transaction(async (tx): Promise<ChangeResult> => {
    const [held] = await tx.select().from(machines).where(and(eq(machines.id, heldId), eq(machines.pendingReview, true))).limit(1);
    const [into] = await tx.select().from(machines).where(and(eq(machines.id, intoId), ne(machines.id, heldId), eq(machines.pendingReview, false))).limit(1);
    if (!held || !into) return { ok: false, message: "ไม่พบเครื่องจักรที่จะรวม" };
    const moved = await tx.update(fuelIssueLines).set({ machineId: intoId }).where(eq(fuelIssueLines.machineId, heldId)).returning({ issueId: fuelIssueLines.issueId });
    for (const id of new Set(moved.map((r) => r.issueId))) {
      await tx.insert(fuelIssueAudit).values({ issueId: id, userId: session.userId, action: "update", changes: { machine: [held.code, into.code] } });
    }
    await tx.delete(machines).where(eq(machines.id, heldId));
    return { ok: true };
  });
}

/** slips waiting for a check, optionally only those of one claim cycle */
export async function countPendingReview(cycleId?: string): Promise<number> {
  const rows = await db
    .select({ id: fuelIssues.id })
    .from(fuelIssues)
    .where(and(eq(fuelIssues.reviewStatus, "pending_review"), eq(fuelIssues.source, "mobile"), isNull(fuelIssues.cancelledAt), cycleId ? eq(fuelIssues.claimCycleId, cycleId) : undefined));
  return rows.length;
}

// ───────────── the "ตรวจใบมือถือ" desk ─────────────

export type PendingCheck = {
  id: string;
  bookNo: string;
  docNo: string;
  projectRef: string;
  projectName: string;
  issueDate: string;
  timeIn: string | null;
  timeOut: string | null;
  recordedAt: string | null;
  receivedAt: string | null;
  liters: number;
  machines: number;
  signed: boolean;
  receiverName: string | null;
  flags: string[];
  confirmedWarnings: string[];
};

/** phone slips nobody has checked yet, oldest first (design: "เก่าสุดอยู่บน") */
export async function listPendingChecks(session: Session): Promise<PendingCheck[]> {
  const scope = await visibleProjectIds(session);
  if (scope && scope.length === 0) return [];
  const heads = await db
    .select({ i: fuelIssues, projectRef: projects.refCode, projectName: projects.name })
    .from(fuelIssues)
    .innerJoin(projects, eq(projects.id, fuelIssues.projectId))
    .where(and(eq(fuelIssues.source, "mobile"), eq(fuelIssues.reviewStatus, "pending_review"), isNull(fuelIssues.cancelledAt), scope ? inArray(fuelIssues.projectId, scope) : undefined))
    .orderBy(sql`coalesce(${fuelIssues.recordedAt}, ${fuelIssues.receivedAt}, ${fuelIssues.createdAt}) asc`)
    .limit(500);
  if (heads.length === 0) return [];
  const lines = await db
    .select({ issueId: fuelIssueLines.issueId, liters: fuelIssueLines.liters })
    .from(fuelIssueLines)
    .where(inArray(fuelIssueLines.issueId, heads.map((h) => h.i.id)));
  return heads.map(({ i, projectRef, projectName }) => {
    const ls = lines.filter((l) => l.issueId === i.id);
    return {
      id: i.id,
      bookNo: i.bookNo,
      docNo: i.docNo,
      projectRef,
      projectName,
      issueDate: i.issueDate,
      timeIn: i.timeIn,
      timeOut: i.timeOut,
      recordedAt: i.recordedAt?.toISOString() ?? null,
      receivedAt: i.receivedAt?.toISOString() ?? null,
      liters: sumLiters(ls.map((l) => l.liters)),
      machines: ls.length,
      signed: i.receivedSigned,
      receiverName: i.receiverName,
      flags: withDateFlags(i.flags, i.issueDate, i.receivedAt?.toISOString() ?? null),
      confirmedWarnings: i.confirmedWarnings,
    };
  });
}

/** "ตรวจแล้ววันนี้ n ใบ" */
export async function countCheckedToday(today: string): Promise<number> {
  const rows = await db
    .select({ id: fuelIssues.id })
    .from(fuelIssues)
    .where(and(eq(fuelIssues.source, "mobile"), eq(fuelIssues.reviewStatus, "checked"), gte(fuelIssues.reviewedAt, new Date(`${today}T00:00:00+07:00`))));
  return rows.length;
}

/**
 * "บันทึกการแก้ และตรวจแล้ว": the meter photo shows other liters than the driver typed.
 * Only the liters of each line change (by position); the reason goes in the history; then the slip is checked.
 */
export async function correctAndCheck(session: Session, id: string, liters: { position: number; liters: number }[], reason: string): Promise<ChangeResult> {
  if (!reason.trim()) return { ok: false, message: "ใส่เหตุผลที่แก้ก่อนบันทึก" };
  const cur = await getIssueForEdit(session, id);
  if (!cur) return { ok: false, message: "ไม่พบใบนี้" };
  if (cur.lock) return { ok: false, message: cur.lock };
  const lines = cur.input.lines.map((l, i) => ({ ...l, liters: liters.find((x) => x.position === i + 1)?.liters ?? l.liters }));
  const r = await updateIssue(session, id, { ...cur.input, lines }, reason);
  if (!r.ok) return r;
  return markChecked(session, id);
}
