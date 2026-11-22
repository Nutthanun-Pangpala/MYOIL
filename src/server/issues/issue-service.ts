import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, max, ne, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { checkIssue, machineKey, type IssueCheck, type IssueContext, type IssueInput } from "@/domain/issue-check";
import { cancelReasonError, changeLock } from "@/domain/issue-actions";
import { receiverNameError } from "@/domain/rules";
import { lineAmount, sumAmounts, sumLiters } from "@/domain/money";
import { thaiMonthShort, thaiShort } from "@/domain/thai-date";
import type { Session } from "@/lib/session";
import { cycleIdFor } from "../cycles/cycle-service";
import { priceForDate } from "../prices/price-queries";
import { visibleProjectIds } from "../projects/project-scope";

const { fuelIssues, fuelIssueLines, fuelIssueAudit, machines, projects, claimCycles } = schema;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ───────────── checks (shared by the live preview and the save) ─────────────

/** Loads what the pure rules need to know about the database. `excludeId` = the slip being edited. */
export async function loadIssueContext(input: IssueInput, excludeId?: string): Promise<IssueContext> {
  const book = input.bookNo.trim();
  const doc = input.docNo.trim();

  let duplicateIssueId: string | null = null;
  if (book && doc) {
    const [dup] = await db
      .select({ id: fuelIssues.id })
      .from(fuelIssues)
      .where(and(eq(fuelIssues.bookNo, book), eq(fuelIssues.docNo, doc), excludeId ? ne(fuelIssues.id, excludeId) : undefined))
      .limit(1);
    duplicateIssueId = dup?.id ?? null;
  }

  // a slip carried into an open cycle keeps its old date: editing it without moving the date is fine
  let sameDateAsSaved = false;
  if (excludeId && input.issueDate) {
    const [cur] = await db.select({ d: fuelIssues.issueDate }).from(fuelIssues).where(eq(fuelIssues.id, excludeId)).limit(1);
    sameDateAsSaved = cur?.d === input.issueDate;
  }
  let closedCycleLabel: string | null = null;
  if (input.issueDate && !sameDateAsSaved) {
    const [c] = await db
      .select({ start: claimCycles.startDate })
      .from(claimCycles)
      .where(
        and(
          eq(claimCycles.status, "closed"),
          lte(claimCycles.startDate, input.issueDate),
          gte(claimCycles.endDate, input.issueDate),
        ),
      )
      .limit(1);
    if (c) closedCycleLabel = thaiMonthShort(c.start);
  }

  const history: IssueContext["history"] = {};
  const keys = [...new Set(input.lines.map((l) => machineKey(l.machine)).filter(Boolean))];
  for (const key of keys) {
    const [m] = await db.select({ id: machines.id }).from(machines).where(eq(machines.key, key)).limit(1);
    if (!m) continue; // a machine never seen has no history

    const live = and(eq(fuelIssueLines.machineId, m.id), isNull(fuelIssues.cancelledAt), excludeId ? ne(fuelIssues.id, excludeId) : undefined);

    const [last] = await db
      .select({ value: fuelIssueLines.hourMeter, date: fuelIssues.issueDate })
      .from(fuelIssueLines)
      .innerJoin(fuelIssues, eq(fuelIssueLines.issueId, fuelIssues.id))
      .where(and(live, isNotNull(fuelIssueLines.hourMeter), input.issueDate ? lte(fuelIssues.issueDate, input.issueDate) : undefined))
      .orderBy(desc(fuelIssues.issueDate), desc(fuelIssues.createdAt))
      .limit(1);

    const [stats] = await db
      .select({ maxLiters: max(fuelIssueLines.liters), fills: count() })
      .from(fuelIssueLines)
      .innerJoin(fuelIssues, eq(fuelIssueLines.issueId, fuelIssues.id))
      .where(live);

    history[key] = {
      lastHourMeter: last && last.value !== null ? { value: last.value, date: thaiShort(last.date) } : null,
      maxLiters: stats?.maxLiters != null ? Number(stats.maxLiters) : null,
      fills: Number(stats?.fills ?? 0),
    };
  }

  return { duplicateIssueId, closedCycleLabel, history };
}

/** What the form shows while typing: the checks plus the price that would be used. */
export async function previewIssue(input: IssueInput, excludeId?: string) {
  const ctx = await loadIssueContext(input, excludeId);
  const check = checkIssue(input, ctx);
  const price = input.issueDate ? await priceForDate(input.issueDate) : null;
  return { check, price, duplicateIssueId: ctx.duplicateIssueId };
}

// ───────────── save ─────────────

export type SaveResult = { ok: true; id: string } | { ok: false; check: IssueCheck };

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

/** machine key → id; creates machines that don't exist yet (the admin adds them while keying) */
async function resolveMachines(tx: Tx, codes: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const raw of codes) {
    const key = machineKey(raw);
    if (out.has(key)) continue;
    const code = raw.trim().replace(/\s+/g, " ");
    await tx.insert(machines).values({ code, key }).onConflictDoNothing({ target: machines.key });
    const [m] = await tx.select({ id: machines.id }).from(machines).where(eq(machines.key, key)).limit(1);
    out.set(key, m.id);
  }
  return out;
}

export async function createIssue(session: Session, input: IssueInput): Promise<SaveResult> {
  const check = checkIssue(input, await loadIssueContext(input));
  if (!check.ok) return { ok: false, check };

  const price = await priceForDate(input.issueDate); // null → "รอราคา": liters saved, money left empty

  try {
    const id = await db.transaction(async (tx) => {
      const machineIds = await resolveMachines(tx, input.lines.map((l) => l.machine));

      const cycleId = await cycleIdFor(tx, input.issueDate);

      const [issue] = await tx
        .insert(fuelIssues)
        .values({
          bookNo: input.bookNo.trim(),
          docNo: input.docNo.trim(),
          issueDate: input.issueDate,
          projectId: input.projectId!,
          claimCycleId: cycleId,
          timeIn: input.timeIn || null,
          timeOut: input.timeOut || null,
          fuelDriver: input.fuelDriver.trim() || null,
          machineDriver: input.machineDriver.trim() || null,
          receivedSigned: input.receivedSigned,
          receiverName: input.receivedSigned ? input.receiverName.trim() : input.receiverName.trim() || null,
          recordedBy: session.userId,
        })
        .returning({ id: fuelIssues.id });

      await tx.insert(fuelIssueLines).values(
        input.lines.map((l, i) => ({
          issueId: issue.id,
          position: i + 1,
          machineId: machineIds.get(machineKey(l.machine))!,
          hourMeter: l.hourMeter,
          liters: l.liters!,
          pricePerLiter: price,
          amount: price === null ? null : lineAmount(l.liters!, price),
        })),
      );

      await tx.insert(fuelIssueAudit).values({ issueId: issue.id, userId: session.userId, action: "create", changes: null });
      return issue.id;
    });
    return { ok: true, id };
  } catch (e) {
    if (isUniqueViolation(e)) {
      // two people keyed the same book+doc at once: the database index is the last line of defence
      const again = checkIssue(input, { ...(await loadIssueContext(input)), duplicateIssueId: "race" });
      return { ok: false, check: again };
    }
    throw e;
  }
}

// ───────────── read ─────────────

export type IssueBadge = "unsigned" | "pending_price" | "invoiced" | "cancelled";

export type IssueRow = {
  id: string;
  bookNo: string;
  docNo: string;
  issueDate: string;
  projectRef: string;
  projectName: string;
  machines: string[];
  liters: number;
  amount: number | null; // null = รอราคา for every line
  badges: IssueBadge[];
};

export type IssueFilters = { from?: string; to?: string; projectId?: string; q?: string; /** only slips not yet signed for (and not cancelled) */ unsigned?: boolean; /** part of a machine code */ machine?: string; status?: "cancelled" | "active" };

export async function listIssues(session: Session, f: IssueFilters): Promise<IssueRow[]> {
  const scope = await visibleProjectIds(session);
  if (scope && scope.length === 0) return [];
  const q = f.q?.trim();

  const heads = await db
    .select({
      id: fuelIssues.id,
      bookNo: fuelIssues.bookNo,
      docNo: fuelIssues.docNo,
      issueDate: fuelIssues.issueDate,
      receivedSigned: fuelIssues.receivedSigned,
      cancelledAt: fuelIssues.cancelledAt,
      projectRef: projects.refCode,
      projectName: projects.name,
      cycleStatus: claimCycles.status,
    })
    .from(fuelIssues)
    .innerJoin(projects, eq(fuelIssues.projectId, projects.id))
    .leftJoin(claimCycles, eq(fuelIssues.claimCycleId, claimCycles.id))
    .where(
      and(
        scope ? inArray(fuelIssues.projectId, scope) : undefined,
        f.projectId ? eq(fuelIssues.projectId, f.projectId) : undefined,
        f.from ? gte(fuelIssues.issueDate, f.from) : undefined,
        f.to ? lte(fuelIssues.issueDate, f.to) : undefined,
        f.unsigned ? and(eq(fuelIssues.receivedSigned, false), isNull(fuelIssues.cancelledAt)) : undefined,
        f.status === "cancelled" ? isNotNull(fuelIssues.cancelledAt) : undefined,
        f.status === "active" ? isNull(fuelIssues.cancelledAt) : undefined,
        f.machine?.trim()
          ? inArray(
              fuelIssues.id,
              db
                .select({ id: fuelIssueLines.issueId })
                .from(fuelIssueLines)
                .innerJoin(machines, eq(fuelIssueLines.machineId, machines.id))
                .where(ilike(machines.code, `%${f.machine.trim()}%`)),
            )
          : undefined,
        q ? or(ilike(fuelIssues.docNo, `%${q}%`), ilike(fuelIssues.bookNo, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(desc(fuelIssues.issueDate), desc(fuelIssues.createdAt))
    .limit(2000);

  if (heads.length === 0) return [];

  const lines = await db
    .select({
      issueId: fuelIssueLines.issueId,
      machine: machines.code,
      liters: fuelIssueLines.liters,
      amount: fuelIssueLines.amount,
    })
    .from(fuelIssueLines)
    .innerJoin(machines, eq(fuelIssueLines.machineId, machines.id))
    .where(inArray(fuelIssueLines.issueId, heads.map((h) => h.id)))
    .orderBy(asc(fuelIssueLines.issueId), asc(fuelIssueLines.position));

  const byIssue = new Map<string, typeof lines>();
  for (const l of lines) (byIssue.get(l.issueId) ?? byIssue.set(l.issueId, []).get(l.issueId)!).push(l);

  return heads.map((h) => {
    const ls = byIssue.get(h.id) ?? [];
    const priced = ls.filter((l) => l.amount !== null);
    const badges: IssueBadge[] = [];
    if (h.cancelledAt) badges.push("cancelled");
    else {
      if (!h.receivedSigned) badges.push("unsigned");
      if (priced.length < ls.length) badges.push("pending_price");
      if (h.cycleStatus === "closed" && h.receivedSigned && priced.length === ls.length) badges.push("invoiced"); // OBS-13: no price = cannot be billed
    }
    return {
      id: h.id,
      bookNo: h.bookNo,
      docNo: h.docNo,
      issueDate: h.issueDate,
      projectRef: h.projectRef,
      projectName: h.projectName,
      machines: ls.map((l) => l.machine),
      liters: sumLiters(ls.map((l) => l.liters)),
      amount: priced.length === 0 ? null : sumAmounts(priced.map((l) => l.amount!)),
      badges,
    };
  });
}

export type IssueDetail = {
  head: typeof fuelIssues.$inferSelect & { projectRef: string; projectName: string; recordedByName: string };
  lines: { position: number; machine: string; hourMeter: number | null; liters: number; pricePerLiter: number | null; amount: number | null }[];
  audit: { action: string; at: Date; userName: string | null; changes: unknown }[];
  /** label like "ก.ย. 2569" when the slip belongs to a closed cycle */
  closedCycleLabel: string | null;
};

export async function getIssue(session: Session, id: string): Promise<IssueDetail | null> {
  const [row] = await db
    .select({ issue: fuelIssues, projectRef: projects.refCode, projectName: projects.name, recordedByName: schema.users.name, cycleStatus: claimCycles.status, cycleStart: claimCycles.startDate })
    .from(fuelIssues)
    .leftJoin(claimCycles, eq(fuelIssues.claimCycleId, claimCycles.id))
    .innerJoin(projects, eq(fuelIssues.projectId, projects.id))
    .innerJoin(schema.users, eq(fuelIssues.recordedBy, schema.users.id))
    .where(eq(fuelIssues.id, id))
    .limit(1);
  if (!row) return null;

  const scope = await visibleProjectIds(session);
  if (scope && !scope.includes(row.issue.projectId)) return null; // not yours = not found

  const lines = await db
    .select({
      position: fuelIssueLines.position,
      machine: machines.code,
      hourMeter: fuelIssueLines.hourMeter,
      liters: fuelIssueLines.liters,
      pricePerLiter: fuelIssueLines.pricePerLiter,
      amount: fuelIssueLines.amount,
    })
    .from(fuelIssueLines)
    .innerJoin(machines, eq(fuelIssueLines.machineId, machines.id))
    .where(eq(fuelIssueLines.issueId, id))
    .orderBy(asc(fuelIssueLines.position));

  const audit = await db
    .select({ action: fuelIssueAudit.action, at: fuelIssueAudit.at, userName: schema.users.name, changes: fuelIssueAudit.changes })
    .from(fuelIssueAudit)
    .leftJoin(schema.users, eq(fuelIssueAudit.userId, schema.users.id))
    .where(eq(fuelIssueAudit.issueId, id))
    .orderBy(desc(fuelIssueAudit.at));

  return {
    head: { ...row.issue, projectRef: row.projectRef, projectName: row.projectName, recordedByName: row.recordedByName },
    lines,
    audit,
    closedCycleLabel: row.cycleStatus === "closed" ? thaiMonthShort(row.cycleStart!) : null,
  };
}

// ───────────── pickers for the form ─────────────

export async function projectOptions(session: Session) {
  const scope = await visibleProjectIds(session);
  if (scope && scope.length === 0) return [];
  return db
    .select({ id: projects.id, refCode: projects.refCode, name: projects.name })
    .from(projects)
    .where(and(eq(projects.isActive, true), scope ? inArray(projects.id, scope) : undefined))
    .orderBy(asc(projects.refCode));
}

export async function machineOptions() {
  return db.select({ code: machines.code }).from(machines).orderBy(asc(machines.code));
}

/** the slip number the admin most likely keys next: last slip of the same book + 1 */
export async function lastIssueNumbers(session: Session): Promise<{ bookNo: string; docNo: string } | null> {
  const [r] = await db
    .select({ bookNo: fuelIssues.bookNo, docNo: fuelIssues.docNo })
    .from(fuelIssues)
    .where(eq(fuelIssues.recordedBy, session.userId))
    .orderBy(desc(fuelIssues.createdAt))
    .limit(1);
  return r ?? null;
}


// ───────────── change a saved slip: edit · sign · cancel · restore ─────────────

export type ChangeResult = { ok: true } | { ok: false; message: string; check?: IssueCheck };

type Head = typeof fuelIssues.$inferSelect;

/** the slip, if this person may see it, with the reason it can't be changed (if any) */
async function loadForChange(session: Session, id: string): Promise<{ head: Head; lock: string | null } | null> {
  const [row] = await db
    .select({ head: fuelIssues, cycleStatus: claimCycles.status, cycleStart: claimCycles.startDate })
    .from(fuelIssues)
    .leftJoin(claimCycles, eq(fuelIssues.claimCycleId, claimCycles.id))
    .where(eq(fuelIssues.id, id))
    .limit(1);
  if (!row) return null;
  const scope = await visibleProjectIds(session);
  if (scope && !scope.includes(row.head.projectId)) return null;
  const lock = changeLock({
    cancelled: row.head.cancelledAt !== null,
    closedCycleLabel: row.cycleStatus === "closed" ? thaiMonthShort(row.cycleStart!) : null,
  });
  return { head: row.head, lock };
}

const NOT_FOUND: ChangeResult = { ok: false, message: "ไม่พบใบนี้" };

export async function markIssueSigned(session: Session, id: string, receiverName: string): Promise<ChangeResult> {
  const cur = await loadForChange(session, id);
  if (!cur) return NOT_FOUND;
  if (cur.lock) return { ok: false, message: cur.lock };
  const err = receiverNameError(true, receiverName);
  if (err) return { ok: false, message: err };
  const name = receiverName.trim().slice(0, 100);
  await db.transaction(async (tx) => {
    await tx.update(fuelIssues).set({ receivedSigned: true, receiverName: name, updatedAt: new Date() }).where(eq(fuelIssues.id, id));
    await tx.insert(fuelIssueAudit).values({
      issueId: id,
      userId: session.userId,
      action: "update",
      changes: { receivedSigned: [cur.head.receivedSigned, true], receiverName: [cur.head.receiverName, name] },
    });
  });
  return { ok: true };
}

export async function cancelIssue(session: Session, id: string, reason: string): Promise<ChangeResult> {
  const cur = await loadForChange(session, id);
  if (!cur) return NOT_FOUND;
  if (cur.lock) return { ok: false, message: cur.lock };
  const err = cancelReasonError(reason);
  if (err) return { ok: false, message: err };
  const why = reason.trim().slice(0, 300);
  await db.transaction(async (tx) => {
    await tx.update(fuelIssues).set({ cancelledAt: new Date(), cancelReason: why, updatedAt: new Date() }).where(eq(fuelIssues.id, id));
    await tx.insert(fuelIssueAudit).values({ issueId: id, userId: session.userId, action: "cancel", changes: { reason: [null, why] } });
  });
  return { ok: true };
}

export async function restoreIssue(session: Session, id: string): Promise<ChangeResult> {
  const [row] = await db
    .select({ head: fuelIssues, cycleStatus: claimCycles.status, cycleStart: claimCycles.startDate })
    .from(fuelIssues)
    .leftJoin(claimCycles, eq(fuelIssues.claimCycleId, claimCycles.id))
    .where(eq(fuelIssues.id, id))
    .limit(1);
  if (!row) return NOT_FOUND;
  const scope = await visibleProjectIds(session);
  if (scope && !scope.includes(row.head.projectId)) return NOT_FOUND;
  if (!row.head.cancelledAt) return { ok: true };
  if (row.cycleStatus === "closed") {
    return { ok: false, message: changeLock({ cancelled: false, closedCycleLabel: thaiMonthShort(row.cycleStart!) })! };
  }
  // the number may have been keyed again while this one was cancelled
  const [dup] = await db
    .select({ id: fuelIssues.id })
    .from(fuelIssues)
    .where(and(eq(fuelIssues.bookNo, row.head.bookNo), eq(fuelIssues.docNo, row.head.docNo), ne(fuelIssues.id, id), isNull(fuelIssues.cancelledAt)))
    .limit(1);
  if (dup) return { ok: false, message: "เล่มที่และเลขที่นี้มีใบอื่นใช้อยู่แล้ว นำกลับมาไม่ได้" };
  await db.transaction(async (tx) => {
    await tx.update(fuelIssues).set({ cancelledAt: null, cancelReason: null, updatedAt: new Date() }).where(eq(fuelIssues.id, id));
    await tx.insert(fuelIssueAudit).values({ issueId: id, userId: session.userId, action: "restore", changes: null });
  });
  return { ok: true };
}

/** a slip as the form holds it, for editing */
export async function getIssueForEdit(session: Session, id: string) {
  const cur = await loadForChange(session, id);
  if (!cur) return null;
  const lines = await db
    .select({ machine: machines.code, hourMeter: fuelIssueLines.hourMeter, liters: fuelIssueLines.liters })
    .from(fuelIssueLines)
    .innerJoin(machines, eq(fuelIssueLines.machineId, machines.id))
    .where(eq(fuelIssueLines.issueId, id))
    .orderBy(asc(fuelIssueLines.position));
  const h = cur.head;
  const input: IssueInput = {
    bookNo: h.bookNo,
    docNo: h.docNo,
    issueDate: h.issueDate,
    projectId: h.projectId,
    timeIn: h.timeIn ?? "",
    timeOut: h.timeOut ?? "",
    fuelDriver: h.fuelDriver ?? "",
    machineDriver: h.machineDriver ?? "",
    lines: lines.map((l) => ({ machine: l.machine, hourMeter: l.hourMeter, liters: l.liters })),
    receivedSigned: h.receivedSigned,
    receiverName: h.receiverName ?? "",
  };
  return { input, lock: cur.lock };
}

export async function updateIssue(session: Session, id: string, input: IssueInput): Promise<ChangeResult> {
  const cur = await loadForChange(session, id);
  if (!cur) return NOT_FOUND;
  if (cur.lock) return { ok: false, message: cur.lock };
  const check = checkIssue(input, await loadIssueContext(input, id));
  if (!check.ok) return { ok: false, message: "ตรวจช่องที่ขึ้นสีแดงก่อน", check };

  const price = await priceForDate(input.issueDate);
  const before = cur.head;
  const changes: Record<string, [unknown, unknown]> = {};
  const note = (k: string, a: unknown, b: unknown) => a !== b && (changes[k] = [a, b]);
  note("bookNo", before.bookNo, input.bookNo.trim());
  note("docNo", before.docNo, input.docNo.trim());
  note("issueDate", before.issueDate, input.issueDate);
  note("projectId", before.projectId, input.projectId);
  note("receivedSigned", before.receivedSigned, input.receivedSigned);
  note("receiverName", before.receiverName ?? "", input.receiverName.trim());

  try {
    await db.transaction(async (tx) => {
      // old → new lines, in words, so the history says what changed (OBS-11)
      const oldLines = await tx
        .select({ machine: machines.code, liters: fuelIssueLines.liters })
        .from(fuelIssueLines)
        .innerJoin(machines, eq(machines.id, fuelIssueLines.machineId))
        .where(eq(fuelIssueLines.issueId, id))
        .orderBy(asc(fuelIssueLines.position));
      const words = (ls: { machine: string; liters: number | null }[]) => ls.map((l) => `${l.machine} ${l.liters} ลิตร`).join(", ");
      if (before.projectId !== input.projectId) {
        const refs = await tx.select({ id: projects.id, ref: projects.refCode }).from(projects).where(inArray(projects.id, [before.projectId, input.projectId!]));
        const ref = (pid: string | null) => refs.find((r) => r.id === pid)?.ref ?? "-";
        note("project", ref(before.projectId), ref(input.projectId));
      }
      note("lines", words(oldLines), words(input.lines.map((l) => ({ machine: l.machine.trim(), liters: l.liters }))));
      const machineIds = await resolveMachines(tx, input.lines.map((l) => l.machine));
      const cycleId = input.issueDate === before.issueDate && before.claimCycleId ? before.claimCycleId : await cycleIdFor(tx, input.issueDate);
      await tx
        .update(fuelIssues)
        .set({
          bookNo: input.bookNo.trim(),
          docNo: input.docNo.trim(),
          issueDate: input.issueDate,
          projectId: input.projectId!,
          claimCycleId: cycleId,
          timeIn: input.timeIn || null,
          timeOut: input.timeOut || null,
          fuelDriver: input.fuelDriver.trim() || null,
          machineDriver: input.machineDriver.trim() || null,
          receivedSigned: input.receivedSigned,
          receiverName: input.receiverName.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(fuelIssues.id, id));
      await tx.delete(fuelIssueLines).where(eq(fuelIssueLines.issueId, id));
      await tx.insert(fuelIssueLines).values(
        input.lines.map((l, i) => ({
          issueId: id,
          position: i + 1,
          machineId: machineIds.get(machineKey(l.machine))!,
          hourMeter: l.hourMeter,
          liters: l.liters!,
          pricePerLiter: price,
          amount: price === null ? null : lineAmount(l.liters!, price),
        })),
      );
      await tx.insert(fuelIssueAudit).values({ issueId: id, userId: session.userId, action: "update", changes });
    });
    return { ok: true };
  } catch (e) {
    if (isUniqueViolation(e)) {
      const again = checkIssue(input, { ...(await loadIssueContext(input, id)), duplicateIssueId: "race" });
      return { ok: false, message: "เล่มที่และเลขที่นี้มีใบอื่นใช้อยู่แล้ว", check: again };
    }
    throw e;
  }
}
