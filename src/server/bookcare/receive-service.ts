import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { appBookNo, appDocNo, purchaseFlags, type IssueRequest, type PurchaseRequest, type SignatureRequest } from "@/domain/bookcare-api";
import { dayAfter } from "@/domain/cycle";
import { machineKey } from "@/domain/issue-check";
import { lineAmount, sumLiters } from "@/domain/money";
import { completePurchase } from "@/domain/purchase-calc";
import { cycleIdFor } from "../cycles/cycle-service";
import { stockOn, tankCapacity } from "../ledger/ledger-service";
import { billForDate, priceForDate } from "../prices/price-queries";
import { repriceOpenLines } from "../purchases/purchase-service";
import { contentHash, decodeImage, type DecodedImage } from "./images";
import { checkStopForIssue, fillStop, stopForIssue } from "../routes/route-service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const { fuelIssues, fuelIssueLines, fuelIssueLinePhotos, fuelIssueAudit, issueSignedPhotos, fuelPurchases, purchaseBillPhotos, purchaseAudit, machines, claimCycles, projects, users } = schema;

export type Fail = { ok: false; status: 400 | 404 | 409 | 413; code: string; message: string; field?: string };
export type Done<T> = { ok: true; status: 200 | 201; body: T };
const fail = (status: Fail["status"], code: string, message: string, field?: string): Fail => ({ ok: false, status, code, message, field });

/** thrown inside a transaction to roll it back with an API answer */
class Refuse extends Error {
  constructor(public f: Fail) {
    super(f.message);
  }
}

const BOOKCARE_EMAIL = "bookcare@system.invalid";
/** the inactive "BookCare" user that owns recorded_by of phone slips; made on first use */
export async function bookcareUserId(tx: Tx | typeof db = db): Promise<string> {
  await tx.insert(users).values({ name: "BookCare (มือถือ พขร.)", email: BOOKCARE_EMAIL, passwordHash: "!", role: "system_admin", active: false }).onConflictDoNothing({ target: users.email });
  const [u] = await tx.select({ id: users.id }).from(users).where(eq(users.email, BOOKCARE_EMAIL)).limit(1);
  return u.id;
}

/** the cycle of `date`, or the first open one after it (a closed cycle never takes a new slip: R14) */
async function openCycleFor(tx: Tx, date: string): Promise<{ id: string; late: boolean }> {
  let id = await cycleIdFor(tx, date);
  let late = false;
  for (let i = 0; i < 24; i++) {
    const [c] = await tx.select({ status: claimCycles.status, end: claimCycles.endDate }).from(claimCycles).where(eq(claimCycles.id, id)).limit(1);
    if (c.status !== "closed") return { id, late };
    late = true;
    id = await cycleIdFor(tx, dayAfter(c.end));
  }
  throw new Refuse(fail(400, "invalid", "หารอบเคลมที่เปิดอยู่ไม่พบ", "issueDate"));
}

const lock = (tx: Tx, key: number) => tx.execute(sql`select pg_advisory_xact_lock(${key})`);

// ───────────── API 1 ─────────────

export type IssueAnswer = { issueId: string; bookNo: string; docNo: string; status: "pending_review" | "checked"; signed: boolean; flags: string[]; duplicate: boolean };

function issueAnswer(r: typeof fuelIssues.$inferSelect, duplicate: boolean): IssueAnswer {
  return { issueId: r.id, bookNo: r.bookNo, docNo: r.docNo, status: r.reviewStatus as IssueAnswer["status"], signed: r.receivedSigned, flags: r.flags, duplicate };
}

export async function receiveIssue(req: IssueRequest): Promise<Done<IssueAnswer> | Fail> {
  // images first: a bad file is a 400/413 before anything is written
  const photos = new Map<number, DecodedImage>();
  for (let i = 0; i < req.lines.length; i++) {
    const d = decodeImage(req.lines[i].photo);
    if (!d.ok) return fail(d.status, d.status === 413 ? "too_large" : "invalid", d.message, `lines[${i}].photo`);
    photos.set(req.lines[i].position, d.image);
  }
  let signature: DecodedImage | null = null;
  if (req.signature) {
    const d = decodeImage(req.signature.image);
    if (!d.ok) return fail(d.status, d.status === 413 ? "too_large" : "invalid", d.message, "signature.image");
    signature = d.image;
  }
  const hash = contentHash(req);

  const [proj] = await db.select({ id: projects.id }).from(projects).where(eq(projects.refCode, req.projectRefCode)).limit(1);
  const [prior] = await db.select().from(fuelIssues).where(eq(fuelIssues.externalRef, req.ref)).limit(1);
  if (prior) return prior.requestHash === hash ? { ok: true, status: 200, body: issueAnswer(prior, true) } : fail(409, "ref_conflict", "ref นี้เคยส่งมาแล้วด้วยเนื้อหาอื่น");
  if (!proj) return fail(404, "unknown_project", `ไม่พบโครงการ ${req.projectRefCode} ใน MYOIL`, "projectRefCode");

  const bill = await billForDate(req.issueDate); // the purchase bill this slip takes its price from
  const price = bill?.pricePerLiter ?? null;
  const total = sumLiters(req.lines.map((l) => l.liters));
  const before = (await stockOn(req.issueDate)).liters;
  const botId = await bookcareUserId();

  try {
    return await db.transaction(async (tx): Promise<Done<IssueAnswer>> => {
      await lock(tx, 884201);
      const [again] = await tx.select().from(fuelIssues).where(eq(fuelIssues.externalRef, req.ref)).limit(1);
      if (again) {
        if (again.requestHash !== hash) throw new Refuse(fail(409, "ref_conflict", "ref นี้เคยส่งมาแล้วด้วยเนื้อหาอื่น"));
        return { ok: true, status: 200, body: issueAnswer(again, true) };
      }

      // the admin's route decides where the truck fills: no stop for this slip → refused (contract §9.1, R20)
      const stop = await stopForIssue(tx, req.routeStopId);
      const stopCheck = checkStopForIssue(stop, { projectRefCode: req.projectRefCode, issueDate: req.issueDate });
      if (!stopCheck.ok) throw new Refuse(fail(stopCheck.status, stopCheck.code, stopCheck.message, stopCheck.field));

      const flags: string[] = [];
      if (stopCheck.wasSkipped) flags.push("was_skipped");
      const cycle = await openCycleFor(tx, req.issueDate);
      if (cycle.late) flags.push("late");

      // machines: by id, else by name; a name that matches nothing is held "รอตรวจชื่อ"
      const machineIds: string[] = [];
      for (let i = 0; i < req.lines.length; i++) {
        const l = req.lines[i];
        let m: { id: string; pendingReview: boolean } | undefined;
        if (l.machineId) {
          [m] = await tx.select({ id: machines.id, pendingReview: machines.pendingReview }).from(machines).where(eq(machines.id, l.machineId)).limit(1);
          if (!m) throw new Refuse(fail(400, "invalid", "ไม่พบเครื่องจักรนี้ใน MYOIL", `lines[${i}].machineId`));
        } else {
          const key = machineKey(l.machineCode);
          [m] = await tx.select({ id: machines.id, pendingReview: machines.pendingReview }).from(machines).where(eq(machines.key, key)).limit(1);
          if (!m) {
            await tx.insert(machines).values({ code: l.machineCode.replace(/\s+/g, " "), key, pendingReview: true }).onConflictDoNothing({ target: machines.key });
            [m] = await tx.select({ id: machines.id, pendingReview: machines.pendingReview }).from(machines).where(eq(machines.key, key)).limit(1);
          }
        }
        if (m.pendingReview) flags.push(`new_machine:${l.position}`);
        machineIds.push(m.id);
      }
      if (sumLiters([before, -total]) < 0) flags.push("over_balance");

      // doc no.: book M<yy><mm> of the slip's date, running number 4 digits, new every month (the lock above keeps two requests from taking the same one)
      const bookNo = appBookNo(req.issueDate);
      const [{ last }] = await tx
        .select({ last: sql<number>`coalesce(max(case when ${fuelIssues.docNo} ~ '^[0-9]{1,9}$' then ${fuelIssues.docNo}::int end), 0)::int` })
        .from(fuelIssues)
        .where(eq(fuelIssues.bookNo, bookNo));
      const docNo = appDocNo(last + 1);

      const [issue] = await tx
        .insert(fuelIssues)
        .values({
          bookNo,
          docNo,
          issueDate: req.issueDate,
          timeIn: req.timeIn,
          timeOut: req.timeOut,
          projectId: proj.id,
          claimCycleId: cycle.id,
          fuelDriver: req.driver.name,
          receivedSigned: !!req.signature,
          receiverName: req.signature?.receiverName ?? null,
          recordedBy: botId,
          source: "mobile",
          externalRef: req.ref,
          requestHash: hash,
          reviewStatus: "pending_review",
          recordedAt: req.recordedAt ? new Date(req.recordedAt) : null,
          receivedAt: new Date(),
          driverBookcareId: req.driver.bookcareUserId,
          signatureRef: null,
          unsignedReason: req.unsignedReason,
          flags,
          confirmedWarnings: req.confirmedWarnings,
          routeStopId: req.routeStopId,
          pricePurchaseId: bill?.id ?? null,
        })
        .returning();
      await fillStop(tx, req.routeStopId!, issue.id);

      const lines = await tx
        .insert(fuelIssueLines)
        .values(
          req.lines.map((l, i) => ({
            issueId: issue.id,
            position: l.position,
            machineId: machineIds[i],
            hourMeter: l.hourMeter,
            liters: l.liters,
            pricePerLiter: price,
            amount: price === null ? null : lineAmount(l.liters, price),
          })),
        )
        .returning({ id: fuelIssueLines.id, position: fuelIssueLines.position });
      for (const line of lines) {
        const p = photos.get(line.position)!;
        await tx.insert(fuelIssueLinePhotos).values({ lineId: line.id, mime: p.mime, sha256: p.sha256, takenAt: p.takenAt, data: p.data });
      }
      if (signature) await tx.insert(issueSignedPhotos).values({ issueId: issue.id, mime: signature.mime, data: signature.data, uploadedBy: botId });
      await tx.insert(fuelIssueAudit).values({ issueId: issue.id, userId: botId, action: "create", changes: null });
      return { ok: true, status: 201, body: issueAnswer(issue, false) };
    });
  } catch (e) {
    if (e instanceof Refuse) return e.f;
    throw e;
  }
}

// ───────────── API 2 ─────────────

export type PurchaseAnswer = { purchaseId: string; status: "pending_confirm" | "confirmed"; flags: string[]; duplicate: boolean };
const purchaseAnswer = (r: typeof fuelPurchases.$inferSelect, duplicate: boolean): PurchaseAnswer => ({ purchaseId: r.id, status: r.status as PurchaseAnswer["status"], flags: r.flags, duplicate });

export async function receivePurchase(req: PurchaseRequest): Promise<Done<PurchaseAnswer> | Fail> {
  const photo = decodeImage(req.billPhoto);
  if (!photo.ok) return fail(photo.status, photo.status === 413 ? "too_large" : "invalid", photo.message, "billPhoto");
  const hash = contentHash(req);
  const [prior] = await db.select().from(fuelPurchases).where(eq(fuelPurchases.externalRef, req.ref)).limit(1);
  if (prior) return prior.requestHash === hash ? { ok: true, status: 200, body: purchaseAnswer(prior, true) } : fail(409, "ref_conflict", "ref นี้เคยส่งมาแล้วด้วยเนื้อหาอื่น");

  const calc = completePurchase({ liters: req.liters, price: null, amount: req.amount });
  if (!calc.ok) return fail(400, "invalid", calc.error, calc.field ?? "amount");
  const flags = purchaseFlags({ liters: calc.liters, price: calc.price, dailyPrice: await priceForDate(req.purchaseDate), capacity: await tankCapacity() });
  const botId = await bookcareUserId();

  try {
    return await db.transaction(async (tx): Promise<Done<PurchaseAnswer>> => {
      await lock(tx, 884202);
      const [again] = await tx.select().from(fuelPurchases).where(eq(fuelPurchases.externalRef, req.ref)).limit(1);
      if (again) {
        if (again.requestHash !== hash) throw new Refuse(fail(409, "ref_conflict", "ref นี้เคยส่งมาแล้วด้วยเนื้อหาอื่น"));
        return { ok: true, status: 200, body: purchaseAnswer(again, true) };
      }
      const [row] = await tx
        .insert(fuelPurchases)
        .values({
          purchaseDate: req.purchaseDate,
          liters: calc.liters,
          pricePerLiter: calc.price,
          amount: calc.amount,
          billNo: req.billNo,
          createdBy: botId,
          source: "mobile",
          externalRef: req.ref,
          requestHash: hash,
          status: "pending_confirm",
          recordedAt: req.recordedAt ? new Date(req.recordedAt) : null,
          driverName: req.driver.name,
          driverBookcareId: req.driver.bookcareUserId,
          flags,
        })
        .returning();
      await tx.insert(purchaseBillPhotos).values({ purchaseId: row.id, mime: photo.image.mime, data: photo.image.data });
      await tx.insert(purchaseAudit).values({ purchaseId: row.id, userId: botId, action: "create", changes: null });
      await repriceOpenLines(tx); // the driver's bill is a price at once (owner, 25 Nov 2026): open slips dated on or after it follow
      return { ok: true, status: 201, body: purchaseAnswer(row, false) };
    });
  } catch (e) {
    if (e instanceof Refuse) return e.f;
    throw e;
  }
}

// ───────────── API 3 ─────────────

export type SignatureAnswer = { signed: true; flags?: string[]; duplicate?: true };

export async function receiveSignature(ref: string, req: SignatureRequest): Promise<Done<SignatureAnswer> | Fail> {
  const img = decodeImage(req.image);
  if (!img.ok) return fail(img.status, img.status === 413 ? "too_large" : "invalid", img.message, "image");
  const botId = await bookcareUserId();
  try {
    return await db.transaction(async (tx): Promise<Done<SignatureAnswer>> => {
      const [cur] = await tx.select().from(fuelIssues).where(eq(fuelIssues.externalRef, ref)).for("update").limit(1);
      if (!cur) throw new Refuse(fail(404, "not_found", "ไม่พบใบที่มี ref นี้"));
      if (cur.cancelledAt) throw new Refuse(fail(409, "issue_cancelled", "ใบนี้ถูกยกเลิกแล้ว"));
      if (cur.signatureRef === req.signatureRef) return { ok: true, status: 200, body: { signed: true, duplicate: true } };
      if (cur.receivedSigned) {
        // the office already recorded the signature: keep theirs, keep the phone's picture for looking at only
        await tx.insert(issueSignedPhotos).values({ issueId: cur.id, mime: img.image.mime, data: img.image.data, uploadedBy: botId }).onConflictDoNothing({ target: issueSignedPhotos.issueId });
        return { ok: true, status: 200, body: { signed: true, flags: ["already_signed"] } };
      }
      // review status is left alone on purpose: checking = meter photo vs liters, which a signature cannot change
      await tx.update(fuelIssues).set({ receivedSigned: true, receiverName: req.receiverName, signatureRef: req.signatureRef, updatedAt: new Date() }).where(eq(fuelIssues.id, cur.id));
      await tx
        .insert(issueSignedPhotos)
        .values({ issueId: cur.id, mime: img.image.mime, data: img.image.data, uploadedBy: botId })
        .onConflictDoUpdate({ target: issueSignedPhotos.issueId, set: { mime: img.image.mime, data: img.image.data, uploadedBy: botId } });
      await tx.insert(fuelIssueAudit).values({
        issueId: cur.id,
        userId: botId,
        action: "update",
        changes: { receivedSigned: [false, true], receiverName: [cur.receiverName, req.receiverName] },
      });
      return { ok: true, status: 200, body: { signed: true, flags: [] } };
    });
  } catch (e) {
    if (e instanceof Refuse) return e.f;
    throw e;
  }
}
