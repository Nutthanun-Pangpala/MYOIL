import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { completePurchase, purchaseOddities } from "@/domain/purchase-calc";
import { loadBills, priceForDate } from "@/server/prices/price-queries";
import { ledgerMonths, tankCapacity } from "@/server/ledger/ledger-service";
import { monthRange } from "@/domain/iso-date";
import { rebill, repriceOpen } from "@/domain/reprice";
import type { Session } from "@/lib/session";
import type { PurchaseInput } from "./parse-input";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PurchaseRow = {
  id: string;
  date: string;
  liters: number;
  pricePerLiter: number;
  amount: number;
  billNo: string | null;
  note: string | null;
  hasPhoto: boolean;
  /** sent from the phone and not yet confirmed by an admin: it already counts in the tank and as a price */
  pendingConfirm: boolean;
  flags: string[];
  cancelled: boolean;
  cancelReason: string | null;
  /** why it cannot be edited or cancelled now (closed cycle), else null */
  lock: string | null;
  history: { action: string; userName: string | null; at: string; text: string }[];
};

export type PurchasePage = {
  purchases: PurchaseRow[];
  /** months to offer as chips, newest first (always includes the one shown) */
  months: string[];
};

export type SaveResult =
  | { ok: true; warnings: string[] }
  /** `confirm` = it looks odd: ask the person, then send again with confirmed (OBS-17) */
  | { ok: false; error: string; field?: "date" | "liters" | "price" | "amount" | "photo"; confirm?: string[] };

export async function loadPurchasePage(month: string, today: string): Promise<PurchasePage> {
  const { start, end } = monthRange(month);
  const [purchases, monthRows] = await Promise.all([
    db
      .select()
      .from(schema.fuelPurchases)
      .where(and(gte(schema.fuelPurchases.purchaseDate, start), lte(schema.fuelPurchases.purchaseDate, end)))
      .orderBy(asc(schema.fuelPurchases.purchaseDate), asc(schema.fuelPurchases.createdAt)),
    db
      .selectDistinct({ m: sql<string>`to_char(${schema.fuelPurchases.purchaseDate}, 'YYYY-MM')` })
      .from(schema.fuelPurchases)
      .where(isNull(schema.fuelPurchases.cancelledAt)),
  ]);
  const closedCycles = await db.select({ start: schema.claimCycles.startDate, end: schema.claimCycles.endDate }).from(schema.claimCycles).where(eq(schema.claimCycles.status, "closed"));
  const audit = purchases.length
    ? await db
        .select({ purchaseId: schema.purchaseAudit.purchaseId, action: schema.purchaseAudit.action, at: schema.purchaseAudit.at, changes: schema.purchaseAudit.changes, userName: schema.users.name })
        .from(schema.purchaseAudit)
        .leftJoin(schema.users, eq(schema.users.id, schema.purchaseAudit.userId))
        .where(inArray(schema.purchaseAudit.purchaseId, purchases.map((p) => p.id)))
        .orderBy(asc(schema.purchaseAudit.at))
    : [];
  const withPhoto = new Set((await db.select({ id: schema.purchaseBillPhotos.purchaseId }).from(schema.purchaseBillPhotos)).map((r) => r.id));
  const months = [...new Set([month, ...(await ledgerMonths(today)), ...monthRows.map((r) => r.m)])].sort().reverse();
  return {
    purchases: purchases.map((p) => ({
      id: p.id,
      date: p.purchaseDate,
      liters: p.liters,
      pricePerLiter: p.pricePerLiter,
      amount: p.amount,
      billNo: p.billNo,
      note: p.note,
      hasPhoto: withPhoto.has(p.id),
      pendingConfirm: p.status === "pending_confirm",
      flags: p.flags,
      cancelled: p.cancelledAt !== null,
      cancelReason: p.cancelReason,
      lock: closedCycles.some((c) => c.start <= p.purchaseDate && p.purchaseDate <= c.end) ? CLOSED_LOCK : null,
      history: audit
        .filter((a) => a.purchaseId === p.id && a.action !== "create")
        .map((a) => ({ action: a.action, userName: a.userName, at: a.at.toISOString(), text: describeChanges(a.changes) })),
    })),
    months,
  };
}

/**
 * A purchase bill was added, corrected, cancelled or brought back: every slip of an OPEN cycle points at the bill
 * of its date again, and its lines take that bill's price (waiting lines get their first price; a slip whose only
 * bill went away goes back to "รอราคา"). Slips of a closed cycle are never touched (a closed invoice never changes).
 */
export async function repriceOpenLines(tx: Tx): Promise<{ priced: number; changed: number }> {
  const bills = await loadBills(tx);
  const open = and(isNull(schema.fuelIssues.cancelledAt), or(isNull(schema.fuelIssues.claimCycleId), ne(schema.claimCycles.status, "closed")));
  const lines = await tx
    .select({ id: schema.fuelIssueLines.id, issueDate: schema.fuelIssues.issueDate, liters: schema.fuelIssueLines.liters, currentPrice: schema.fuelIssueLines.pricePerLiter })
    .from(schema.fuelIssueLines)
    .innerJoin(schema.fuelIssues, eq(schema.fuelIssues.id, schema.fuelIssueLines.issueId))
    .leftJoin(schema.claimCycles, eq(schema.claimCycles.id, schema.fuelIssues.claimCycleId))
    .where(open);
  const updates = repriceOpen(lines, bills);
  for (const u of updates) {
    await tx.update(schema.fuelIssueLines).set({ pricePerLiter: u.pricePerLiter, amount: u.amount }).where(eq(schema.fuelIssueLines.id, u.id));
  }
  const slips = await tx
    .select({ id: schema.fuelIssues.id, issueDate: schema.fuelIssues.issueDate, billId: schema.fuelIssues.pricePurchaseId })
    .from(schema.fuelIssues)
    .leftJoin(schema.claimCycles, eq(schema.claimCycles.id, schema.fuelIssues.claimCycleId))
    .where(open);
  for (const r of rebill(slips, bills)) {
    await tx.update(schema.fuelIssues).set({ pricePurchaseId: r.billId }).where(eq(schema.fuelIssues.id, r.id));
  }
  const priced = updates.filter((u) => u.wasWaiting).length;
  return { priced, changed: updates.length - priced };
}

function repriceWarnings(r: { priced: number; changed: number }): string[] {
  const w: string[] = [];
  if (r.priced > 0) w.push(`ตั้งราคาให้ใบจ่ายที่รอราคาแล้ว ${r.priced} รายการ`);
  if (r.changed > 0) w.push(`ปรับราคาใบจ่ายตามบิลซื้อแล้ว ${r.changed} รายการ (เฉพาะรอบที่ยังไม่ปิด)`);
  return w;
}


export async function createPurchase(session: Session, input: PurchaseInput): Promise<SaveResult> {
  if (!input.date) return { ok: false, error: "เลือกวันที่ซื้อ", field: "date" };
  const calc = completePurchase({ liters: input.liters, price: input.price, amount: input.amount });
  if (!calc.ok) return { ok: false, error: calc.error, field: calc.field };

  let photo: { mime: string; data: Buffer } | null = null;
  if (input.billPhoto) {
    const data = Buffer.from(input.billPhoto.base64, "base64");
    const isJpeg = data[0] === 0xff && data[1] === 0xd8;
    const isPng = data.subarray(0, 4).toString("hex") === "89504e47";
    if (data.length > 1_050_000 || !((input.billPhoto.mime === "image/jpeg" && isJpeg) || (input.billPhoto.mime === "image/png" && isPng))) {
      return { ok: false, error: "รูปบิลต้องเป็นไฟล์ JPG หรือ PNG ขนาดไม่เกิน 1 MB", field: "photo" };
    }
    photo = { mime: input.billPhoto.mime, data };
  }

  if (!input.confirmed) {
    const odd = purchaseOddities({ liters: calc.liters, price: calc.price, dailyPrice: await priceForDate(input.date), capacity: await tankCapacity() });
    if (odd.length > 0) return { ok: false, error: "ตรวจก่อนบันทึก", confirm: odd };
  }

  return db.transaction(async (tx) => {
    const [bought] = await tx.insert(schema.fuelPurchases).values({
      purchaseDate: input.date,
      liters: calc.liters,
      pricePerLiter: calc.price,
      amount: calc.amount,
      billNo: input.billNo || null,
      note: input.note || null,
      createdBy: session.userId,
    }).returning({ id: schema.fuelPurchases.id });
    if (photo) await tx.insert(schema.purchaseBillPhotos).values({ purchaseId: bought.id, ...photo });
    await tx.insert(schema.purchaseAudit).values({ purchaseId: bought.id, userId: session.userId, action: "create", changes: null });

    const warnings: string[] = [];
    warnings.push(...repriceWarnings(await repriceOpenLines(tx)));
    return { ok: true as const, warnings };
  });
}

// ───────────── change a saved purchase (OBS-18): edit, cancel (with a reason), restore. Never deleted. ─────────────

export const CLOSED_LOCK = "ทำไม่ได้ รอบเคลมที่คลุมวันที่นี้ปิดแล้ว ให้ผู้ดูแลระบบเปิดรอบอีกครั้งก่อน";

const FIELD_TH: Record<string, string> = { status: "สถานะ", date: "วันที่", liters: "ลิตร", price: "ราคา/ลิตร", amount: "จำนวนเงิน", billNo: "เลขที่บิล", note: "หมายเหตุ", reason: "เหตุผล" };
function describeChanges(c: unknown): string {
  if (!c || typeof c !== "object") return "";
  return Object.entries(c as Record<string, [unknown, unknown]>)
    .map(([k, v]) => `${FIELD_TH[k] ?? k}: ${v?.[0] === null || v?.[0] === "" ? "-" : v?.[0]} → ${v?.[1] === null || v?.[1] === "" ? "-" : v?.[1]}`)
    .join(" · ");
}

async function inClosedCycle(tx: Tx, date: string): Promise<boolean> {
  const [c] = await tx
    .select({ id: schema.claimCycles.id })
    .from(schema.claimCycles)
    .where(and(eq(schema.claimCycles.status, "closed"), lte(schema.claimCycles.startDate, date), gte(schema.claimCycles.endDate, date)))
    .limit(1);
  return !!c;
}

export async function updatePurchase(session: Session, id: string, input: PurchaseInput): Promise<SaveResult> {
  if (!input.date) return { ok: false, error: "เลือกวันที่ซื้อ", field: "date" };
  const calc = completePurchase({ liters: input.liters, price: input.price, amount: input.amount });
  if (!calc.ok) return { ok: false, error: calc.error, field: calc.field };
  if (!input.confirmed) {
    const odd = purchaseOddities({ liters: calc.liters, price: calc.price, dailyPrice: await priceForDate(input.date), capacity: await tankCapacity() });
    if (odd.length > 0) return { ok: false, error: "ตรวจก่อนบันทึก", confirm: odd };
  }

  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(schema.fuelPurchases).where(eq(schema.fuelPurchases.id, id)).for("update").limit(1);
    if (!cur) return { ok: false as const, error: "ไม่พบรายการซื้อนี้" };
    if (cur.cancelledAt) return { ok: false as const, error: "รายการที่ยกเลิกแล้วแก้ไม่ได้ กด “นำกลับมา” ก่อน" };
    if ((await inClosedCycle(tx, cur.purchaseDate)) || (await inClosedCycle(tx, input.date))) return { ok: false as const, error: CLOSED_LOCK };

    const changes: Record<string, [unknown, unknown]> = {};
    const note = (k: string, a: unknown, b: unknown) => a !== b && (changes[k] = [a, b]);
    note("date", cur.purchaseDate, input.date);
    note("liters", cur.liters, calc.liters);
    note("price", cur.pricePerLiter, calc.price);
    note("amount", cur.amount, calc.amount);
    note("billNo", cur.billNo ?? "", input.billNo);
    note("note", cur.note ?? "", input.note);
    if (Object.keys(changes).length === 0) return { ok: true as const, warnings: ["ไม่มีอะไรเปลี่ยน"] };

    await tx
      .update(schema.fuelPurchases)
      .set({ purchaseDate: input.date, liters: calc.liters, pricePerLiter: calc.price, amount: calc.amount, billNo: input.billNo || null, note: input.note || null })
      .where(eq(schema.fuelPurchases.id, id));
    await tx.insert(schema.purchaseAudit).values({ purchaseId: id, userId: session.userId, action: "update", changes });

    const warnings: string[] = [];
    warnings.push(...repriceWarnings(await repriceOpenLines(tx)));
    return { ok: true as const, warnings };
  });
}

export type ChangeResult = { ok: true } | { ok: false; message: string };

export async function cancelPurchase(session: Session, id: string, reason: string): Promise<ChangeResult> {
  if (!reason.trim()) return { ok: false, message: "ใส่เหตุผลที่ยกเลิก" };
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(schema.fuelPurchases).where(eq(schema.fuelPurchases.id, id)).for("update").limit(1);
    if (!cur) return { ok: false as const, message: "ไม่พบรายการซื้อนี้" };
    if (cur.cancelledAt) return { ok: false as const, message: "รายการนี้ถูกยกเลิกแล้ว" };
    if (await inClosedCycle(tx, cur.purchaseDate)) return { ok: false as const, message: CLOSED_LOCK };
    await tx.update(schema.fuelPurchases).set({ cancelledAt: new Date(), cancelReason: reason.trim(), cancelledBy: session.userId }).where(eq(schema.fuelPurchases.id, id));
    await tx.insert(schema.purchaseAudit).values({ purchaseId: id, userId: session.userId, action: "cancel", changes: { reason: [null, reason.trim()] } });
    await repriceOpenLines(tx); // slips that drew on this bill fall back to the bill before it (or to "รอราคา")
    return { ok: true as const };
  });
}

export async function restorePurchase(session: Session, id: string): Promise<ChangeResult> {
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(schema.fuelPurchases).where(eq(schema.fuelPurchases.id, id)).for("update").limit(1);
    if (!cur) return { ok: false as const, message: "ไม่พบรายการซื้อนี้" };
    if (!cur.cancelledAt) return { ok: false as const, message: "รายการนี้ไม่ได้ถูกยกเลิก" };
    if (await inClosedCycle(tx, cur.purchaseDate)) return { ok: false as const, message: CLOSED_LOCK };
    await tx.update(schema.fuelPurchases).set({ cancelledAt: null, cancelReason: null, cancelledBy: null }).where(eq(schema.fuelPurchases.id, id));
    await tx.insert(schema.purchaseAudit).values({ purchaseId: id, userId: session.userId, action: "restore", changes: null });
    await repriceOpenLines(tx);
    return { ok: true as const };
  });
}


/** an admin confirms a purchase sent from the phone. Its price was already in use from the moment it arrived (owner, 25 Nov 2026). */
export async function confirmPurchase(session: Session, id: string): Promise<ChangeResult & { warnings?: string[] }> {
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(schema.fuelPurchases).where(eq(schema.fuelPurchases.id, id)).for("update").limit(1);
    if (!cur) return { ok: false as const, message: "ไม่พบรายการซื้อนี้" };
    if (cur.cancelledAt) return { ok: false as const, message: "รายการที่ยกเลิกแล้วยืนยันไม่ได้ กด “นำกลับมา” ก่อน" };
    if (cur.status === "confirmed") return { ok: true as const, warnings: [] };
    if (await inClosedCycle(tx, cur.purchaseDate)) return { ok: false as const, message: CLOSED_LOCK };
    await tx.update(schema.fuelPurchases).set({ status: "confirmed", confirmedBy: session.userId, confirmedAt: new Date() }).where(eq(schema.fuelPurchases.id, id));
    await tx.insert(schema.purchaseAudit).values({ purchaseId: id, userId: session.userId, action: "update", changes: { status: ["รอยืนยัน", "ยืนยันแล้ว"] } });

    return { ok: true as const, warnings: repriceWarnings(await repriceOpenLines(tx)) };
  });
}
