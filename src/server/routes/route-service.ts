/**
 * The fuel truck's route of the day (brief R20–R23, contract §9.1): planned by the store admin on /routes,
 * read by BookCare (API 8), filled by API 1 slips, skipped by API 9. Status is derived (domain/route.ts).
 */
import { asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { canChangeStop, checkStopForIssue, moveStop, renumber, stopStatus, type StopStatus } from "@/domain/route";
import type { SkipRequest } from "@/domain/bookcare-api";

const { fuelRoutes, fuelRouteStops, fuelIssues, fuelIssueLines, projects } = schema;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = Tx | typeof db;

export type StopView = {
  id: string;
  position: number;
  projectId: string;
  projectRefCode: string;
  projectName: string;
  note: string | null;
  status: StopStatus;
  issueId: string | null;
  issueRef: string | null;
  issueNo: string | null;
  skipReason: string | null;
  skippedAt: Date | null;
  skippedBy: string | null;
};
export type RouteView = { id: string; date: string; updatedAt: Date; stops: StopView[] } | null;

export async function routeForDate(date: string, q: Db = db): Promise<RouteView> {
  const [r] = await q.select().from(fuelRoutes).where(eq(fuelRoutes.routeDate, date)).limit(1);
  if (!r) return null;
  const rows = await q
    .select({
      s: fuelRouteStops,
      refCode: projects.refCode,
      name: projects.name,
      issueRef: fuelIssues.externalRef,
      cancelled: fuelIssues.cancelledAt,
      bookNo: fuelIssues.bookNo,
      docNo: fuelIssues.docNo,
    })
    .from(fuelRouteStops)
    .innerJoin(projects, eq(projects.id, fuelRouteStops.projectId))
    .leftJoin(fuelIssues, eq(fuelIssues.id, fuelRouteStops.issueId))
    .where(eq(fuelRouteStops.routeId, r.id))
    .orderBy(asc(fuelRouteStops.position));
  return {
    id: r.id,
    date: r.routeDate,
    updatedAt: r.updatedAt,
    stops: rows.map(({ s, refCode, name, issueRef, cancelled, bookNo, docNo }) => {
      const status = stopStatus({ issueId: s.issueId, issueCancelled: !!cancelled, skipRef: s.skipRef });
      return {
        id: s.id,
        position: s.position,
        projectId: s.projectId,
        projectRefCode: refCode,
        projectName: name,
        note: s.note,
        status,
        issueId: status === "filled" ? s.issueId : null,
        issueRef: status === "filled" ? (issueRef ?? null) : null,
        issueNo: status === "filled" && bookNo ? `${bookNo}/${docNo}` : null,
        skipReason: status === "skipped" ? s.skipReason : null,
        skippedAt: status === "skipped" ? s.skippedAt : null,
        skippedBy: status === "skipped" ? s.skippedBy : null,
      };
    }),
  };
}

/** liters of each filled stop's slip, for the driver's route (design board "Main": "ตย.02 · 115 ลิตร") */
export async function litersOfIssues(ids: string[], q: Db = db): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await q
    .select({ id: fuelIssueLines.issueId, liters: sql<string>`sum(${fuelIssueLines.liters})` })
    .from(fuelIssueLines)
    .where(inArray(fuelIssueLines.issueId, ids))
    .groupBy(fuelIssueLines.issueId);
  return new Map(rows.map((r) => [r.id, Number(r.liters)]));
}

/** API 8 answer: no route = 200 with stops [] */
export async function routeForPhone(date: string) {
  const r = await routeForDate(date);
  const iso = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 19) + "+07:00";
  return {
    date,
    vehicleCode: null,
    updatedAt: r ? iso(r.updatedAt) : null,
    stops: (r?.stops ?? []).map((s) => ({ id: s.id, position: s.position, projectRefCode: s.projectRefCode, note: s.note, status: s.status, issueRef: s.issueRef, skipReason: s.skipReason })),
  };
}

/** the stop a phone slip names, with what API 1 needs to decide (domain/route checkStopForIssue) */
export async function stopForIssue(tx: Tx, stopId: string | null) {
  if (!stopId) return null;
  const [row] = await tx
    .select({ s: fuelRouteStops, refCode: projects.refCode, date: fuelRoutes.routeDate, cancelled: fuelIssues.cancelledAt })
    .from(fuelRouteStops)
    .innerJoin(fuelRoutes, eq(fuelRoutes.id, fuelRouteStops.routeId))
    .innerJoin(projects, eq(projects.id, fuelRouteStops.projectId))
    .leftJoin(fuelIssues, eq(fuelIssues.id, fuelRouteStops.issueId))
    .where(eq(fuelRouteStops.id, stopId))
    .for("update", { of: fuelRouteStops })
    .limit(1);
  if (!row) return null;
  return { id: row.s.id, projectRefCode: row.refCode, routeDate: row.date, status: stopStatus({ issueId: row.s.issueId, issueCancelled: !!row.cancelled, skipRef: row.s.skipRef }) };
}

export { checkStopForIssue };

/** API 1 wrote the slip: the stop is filled (same transaction) */
export async function fillStop(tx: Tx, stopId: string, issueId: string) {
  await tx.update(fuelRouteStops).set({ issueId, updatedAt: new Date() }).where(eq(fuelRouteStops.id, stopId));
  await touchRoute(tx, stopId);
}

async function touchRoute(tx: Db, stopId: string) {
  await tx.execute(sql`update fuel_routes set updated_at = now() where id = (select route_id from fuel_route_stops where id = ${stopId})`);
}

export type SkipResult = { ok: true; status: 200; body: { status: "skipped"; duplicate?: true } } | { ok: false; status: 404 | 409; code: string; message: string };

/** API 9: once per skipRef; a stop with its slip can't be skipped */
export async function skipStop(stopId: string, req: SkipRequest): Promise<SkipResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(884203)`);
    const [same] = await tx.select({ id: fuelRouteStops.id }).from(fuelRouteStops).where(eq(fuelRouteStops.skipRef, req.skipRef)).limit(1);
    if (same) return { ok: true, status: 200, body: { status: "skipped", duplicate: true } };
    const stop = await stopForIssue(tx, stopId);
    if (!stop) return { ok: false, status: 404, code: "not_found", message: "ไม่มีจุดนี้ในเส้นทาง (แอดมินอาจลบไปแล้ว)" };
    if (stop.status === "filled") return { ok: false, status: 409, code: "stop_filled", message: "จุดนี้มีใบจ่ายแล้ว ข้ามไม่ได้" };
    await tx
      .update(fuelRouteStops)
      .set({ skipRef: req.skipRef, skipReason: req.reason, skippedAt: new Date(req.skippedAt), skippedBy: req.driver.name || null, updatedAt: new Date() })
      .where(eq(fuelRouteStops.id, stopId));
    await touchRoute(tx, stopId);
    return { ok: true, status: 200, body: { status: "skipped" } };
  });
}

// ───────────── the admin's page (/routes) ─────────────

export type PlanResult = { ok: true } | { ok: false; message: string };

async function routeIdFor(tx: Tx, date: string, userId: string) {
  await tx.insert(fuelRoutes).values({ routeDate: date, createdBy: userId }).onConflictDoNothing({ target: fuelRoutes.routeDate });
  const [r] = await tx.select({ id: fuelRoutes.id }).from(fuelRoutes).where(eq(fuelRoutes.routeDate, date)).limit(1);
  return r.id;
}

async function writeOrder(tx: Tx, routeId: string, order: { id: string; position: number }[]) {
  for (const s of order) await tx.update(fuelRouteStops).set({ position: s.position, updatedAt: new Date() }).where(eq(fuelRouteStops.id, s.id));
  await tx.update(fuelRoutes).set({ updatedAt: new Date() }).where(eq(fuelRoutes.id, routeId));
}

export async function addStop(userId: string, date: string, projectId: string, note: string | null): Promise<PlanResult> {
  const [p] = await db.select({ id: projects.id, active: projects.isActive }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return { ok: false, message: "ไม่พบโครงการนี้" };
  await db.transaction(async (tx) => {
    const routeId = await routeIdFor(tx, date, userId);
    const [{ n }] = await tx.select({ n: sql<number>`coalesce(max(${fuelRouteStops.position}), 0)::int` }).from(fuelRouteStops).where(eq(fuelRouteStops.routeId, routeId));
    await tx.insert(fuelRouteStops).values({ routeId, position: n + 1, projectId, note: note?.trim().slice(0, 300) || null });
    await tx.update(fuelRoutes).set({ updatedAt: new Date() }).where(eq(fuelRoutes.id, routeId));
  });
  return { ok: true };
}

async function changeable(stopId: string) {
  const [row] = await db
    .select({ s: fuelRouteStops, cancelled: fuelIssues.cancelledAt })
    .from(fuelRouteStops)
    .leftJoin(fuelIssues, eq(fuelIssues.id, fuelRouteStops.issueId))
    .where(eq(fuelRouteStops.id, stopId))
    .limit(1);
  if (!row) return { ok: false as const, message: "ไม่พบจุดนี้" };
  if (!canChangeStop(stopStatus({ issueId: row.s.issueId, issueCancelled: !!row.cancelled, skipRef: row.s.skipRef }))) return { ok: false as const, message: "จุดนี้เติมแล้ว แก้ไม่ได้" };
  return { ok: true as const, stop: row.s };
}

export async function updateStopNote(stopId: string, note: string | null): Promise<PlanResult> {
  const c = await changeable(stopId);
  if (!c.ok) return c;
  await db.update(fuelRouteStops).set({ note: note?.trim().slice(0, 300) || null, updatedAt: new Date() }).where(eq(fuelRouteStops.id, stopId));
  await touchRoute(db, stopId);
  return { ok: true };
}

/** "ขึ้น" / "ลง": a filled stop stays where it is, and nothing moves past it */
export async function moveRouteStop(stopId: string, dir: -1 | 1): Promise<PlanResult> {
  const c = await changeable(stopId);
  if (!c.ok) return c;
  return db.transaction(async (tx) => {
    const all = await tx.select({ id: fuelRouteStops.id, position: fuelRouteStops.position }).from(fuelRouteStops).where(eq(fuelRouteStops.routeId, c.stop.routeId));
    const moved = moveStop(all, stopId, dir);
    const swappedWith = moved.find((s) => s.position === all.find((x) => x.id === stopId)!.position && s.id !== stopId);
    if (swappedWith) {
      const other = await changeable(swappedWith.id);
      if (!other.ok) return { ok: false, message: "สลับกับจุดที่เติมแล้วไม่ได้" };
    }
    await writeOrder(tx, c.stop.routeId, moved);
    return { ok: true };
  });
}

export async function removeStop(stopId: string): Promise<PlanResult> {
  const c = await changeable(stopId);
  if (!c.ok) return c;
  await db.transaction(async (tx) => {
    await tx.delete(fuelRouteStops).where(eq(fuelRouteStops.id, stopId));
    const rest = await tx.select({ id: fuelRouteStops.id, position: fuelRouteStops.position }).from(fuelRouteStops).where(eq(fuelRouteStops.routeId, c.stop.routeId));
    await writeOrder(tx, c.stop.routeId, renumber(rest));
  });
  return { ok: true };
}

/** "คัดลอกจากวันก่อน": the last earlier route's projects and notes, in order, all pending. Only into an empty day */
export async function copyPreviousRoute(userId: string, date: string): Promise<PlanResult & { from?: string }> {
  const [prev] = await db.select().from(fuelRoutes).where(lt(fuelRoutes.routeDate, date)).orderBy(desc(fuelRoutes.routeDate)).limit(1);
  if (!prev) return { ok: false, message: "ยังไม่มีเส้นทางของวันก่อนหน้าให้คัดลอก" };
  const stops = await db.select().from(fuelRouteStops).where(eq(fuelRouteStops.routeId, prev.id)).orderBy(asc(fuelRouteStops.position));
  if (!stops.length) return { ok: false, message: "เส้นทางวันก่อนหน้าไม่มีจุด" };
  const existing = await routeForDate(date);
  if (existing?.stops.length) return { ok: false, message: "วันนี้มีจุดอยู่แล้ว คัดลอกได้เฉพาะวันที่ยังว่าง" };
  await db.transaction(async (tx) => {
    const routeId = await routeIdFor(tx, date, userId);
    await tx.insert(fuelRouteStops).values(stops.map((s, i) => ({ routeId, position: i + 1, projectId: s.projectId, note: s.note })));
    await tx.update(fuelRoutes).set({ updatedAt: new Date() }).where(eq(fuelRoutes.id, routeId));
  });
  return { ok: true, from: prev.routeDate };
}

/** e2e helper (scripts/e2e-plan-route.ts): plan a day by project codes, returns the stop ids in order */
export async function planByCodes(userId: string, date: string, codes: string[]): Promise<string[]> {
  const ps = codes.length ? await db.select({ id: projects.id, ref: projects.refCode }).from(projects).where(inArray(projects.refCode, codes)) : [];
  for (const c of codes) {
    const p = ps.find((x) => x.ref === c);
    if (!p) throw new Error(`no project ${c}`);
    await addStop(userId, date, p.id, null);
  }
  const r = await routeForDate(date);
  return (r?.stops ?? []).slice(-codes.length).map((s) => s.id);
}
