import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { allocateFifo, partsAmount, partsPrice, stockValue, type FifoLine, type Lot, type Part } from "@/domain/fifo";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = Tx | typeof db;
const { fuelIssues, fuelIssueLines, fuelIssueLineParts, fuelPurchases, claimCycles, appSettings } = schema;

/** "HH:MM" on the Bangkok clock */
const clock = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(11, 16);

/**
 * Everything that put fuel in the truck, as lots (brief §14): the opening stock at its own price (B8), then every
 * bill that is not cancelled. A bill sent from the phone that the admin has not confirmed has no price yet (B6).
 */
async function loadLots(q: Db): Promise<Lot[]> {
  const [cfg] = await q.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  const from = cfg?.openingDate ?? "0001-01-01";
  const bills = await q.select().from(fuelPurchases).where(isNull(fuelPurchases.cancelledAt)).orderBy(asc(fuelPurchases.purchaseDate), asc(fuelPurchases.createdAt));
  const lots: Lot[] = [];
  if (cfg && cfg.openingLiters > 0) lots.push({ id: null, at: `${from}T00:00`, liters: cfg.openingLiters, price: cfg.openingPrice ?? null });
  for (const b of bills) {
    if (b.purchaseDate < from) continue; // before the book starts: already inside the opening stock
    const time = b.purchaseTime ?? (b.recordedAt ? clock(b.recordedAt) : "00:00");
    lots.push({ id: b.id, at: `${b.purchaseDate}T${time}`, liters: b.liters, price: b.status === "pending_confirm" ? null : b.pricePerLiter });
  }
  return lots;
}

type LineRow = { lineId: string; issueId: string; liters: number; price: number | null; amount: number | null; closed: boolean; at: string };

/** every line of every live slip, in the order the fuel left: date, time (a paper slip with no time goes last that day, B9), then as keyed */
async function loadLines(q: Db): Promise<LineRow[]> {
  const rows = await q
    .select({
      lineId: fuelIssueLines.id,
      issueId: fuelIssues.id,
      liters: fuelIssueLines.liters,
      price: fuelIssueLines.pricePerLiter,
      amount: fuelIssueLines.amount,
      position: fuelIssueLines.position,
      date: fuelIssues.issueDate,
      timeIn: fuelIssues.timeIn,
      recordedAt: fuelIssues.recordedAt,
      createdAt: fuelIssues.createdAt,
      cycle: claimCycles.status,
    })
    .from(fuelIssueLines)
    .innerJoin(fuelIssues, eq(fuelIssues.id, fuelIssueLines.issueId))
    .leftJoin(claimCycles, eq(claimCycles.id, fuelIssues.claimCycleId))
    .where(isNull(fuelIssues.cancelledAt));
  return rows
    .map((r) => ({
      lineId: r.lineId,
      issueId: r.issueId,
      liters: r.liters,
      price: r.price,
      amount: r.amount,
      closed: r.cycle === "closed",
      at: `${r.date}T${r.timeIn ?? (r.recordedAt ? clock(r.recordedAt) : "99:99")}`,
      order: [r.createdAt?.getTime() ?? 0, r.issueId, r.position] as const,
    }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.order[0] - b.order[0] || (a.order[1] < b.order[1] ? -1 : a.order[1] > b.order[1] ? 1 : a.order[2] - b.order[2])));
}

async function loadParts(q: Db, lineIds: string[]): Promise<Map<string, Part[]>> {
  const out = new Map<string, Part[]>();
  for (let i = 0; i < lineIds.length; i += 500) {
    const rows = await q.select().from(fuelIssueLineParts).where(inArray(fuelIssueLineParts.lineId, lineIds.slice(i, i + 500))).orderBy(asc(fuelIssueLineParts.lineId), asc(fuelIssueLineParts.seq));
    for (const r of rows) {
      const p: Part = { kind: r.kind as Part["kind"], lotId: r.purchaseId, liters: r.liters, price: r.pricePerLiter, amount: r.amount };
      (out.get(r.lineId) ?? out.set(r.lineId, []).get(r.lineId)!).push(p);
    }
  }
  return out;
}

const same = (a: Part[] | undefined, b: Part[]) => !!a && a.length === b.length && a.every((p, i) => p.kind === b[i].kind && p.lotId === b[i].lotId && p.liters === b[i].liters && p.price === b[i].price && p.amount === b[i].amount);

async function compute(q: Db, edit?: (lines: LineRow[]) => LineRow[]) {
  const [lots, all] = await Promise.all([loadLots(q), loadLines(q)]);
  const lines = edit ? edit(all) : all;
  const had = await loadParts(q, lines.map((l) => l.lineId));
  const input: FifoLine[] = lines.map((l) => ({ id: l.lineId, at: l.at, liters: l.liters, frozen: l.closed ? had.get(l.lineId) : undefined }));
  const { parts, left } = allocateFifo(lots, input);
  return { lines, had, parts, left };
}

export type Repriced = { /** slips that were waiting for a price and now have their money */ priced: number; /** slips whose money changed */ changed: number };

/**
 * A bill or a slip was added, corrected, cancelled or brought back (B5): every slip of an OPEN cycle is cut into its
 * bills again, oldest fuel first, and its lines take those prices. Slips of a closed cycle keep what they were billed
 * and only use up their bills. Returns how many slips got their first price and how many had their money changed.
 */
export async function repriceOpenLines(tx: Tx, opts: { /** the slip being saved itself: its own new money is not a "change" to warn about */ except?: string } = {}): Promise<Repriced> {
  await tx.execute(sql`select pg_advisory_xact_lock(884210)`); // one at a time: two saves cutting the same bills would both be wrong
  const { lines, had, parts } = await compute(tx);
  const before = new Map<string, (number | null)[]>();
  const after = new Map<string, (number | null)[]>();
  for (const l of lines) {
    if (l.closed) continue;
    const now = parts.get(l.lineId) ?? [];
    const amount = partsAmount(now);
    const price = partsPrice(now);
    if (l.issueId !== opts.except) (before.get(l.issueId) ?? before.set(l.issueId, []).get(l.issueId)!).push(l.amount);
    if (l.issueId !== opts.except) (after.get(l.issueId) ?? after.set(l.issueId, []).get(l.issueId)!).push(amount);
    if (!same(had.get(l.lineId), now)) {
      await tx.delete(fuelIssueLineParts).where(eq(fuelIssueLineParts.lineId, l.lineId));
      if (now.length) await tx.insert(fuelIssueLineParts).values(now.map((p, seq) => ({ lineId: l.lineId, seq, kind: p.kind, purchaseId: p.lotId, liters: p.liters, pricePerLiter: p.price, amount: p.amount })));
    }
    if (l.amount !== amount || l.price !== price) await tx.update(fuelIssueLines).set({ pricePerLiter: price, amount }).where(eq(fuelIssueLines.id, l.lineId));
  }
  let priced = 0;
  let changed = 0;
  for (const [id, was] of before) {
    const now = after.get(id)!;
    if (was.every((v, i) => v === now[i])) continue;
    if (was.some((v) => v === null) && now.every((v) => v !== null)) priced++;
    else changed++;
  }
  return { priced, changed };
}

/** B5: said BEFORE saving, when slips that already have their money would get another amount */
export const changeNote = (n: number) => `ใบจ่าย ${n} ใบในรอบที่ยังไม่ปิดจะเปลี่ยนยอดเงิน เพราะลำดับการใช้น้ำมันตามบิลเปลี่ยน (รอบที่ปิดแล้วไม่เปลี่ยน)`;

/** thrown inside a transaction: undo everything and ask the person first */
export class Ask extends Error {
  constructor(public notes: string[]) {
    super("ask");
  }
}

/** after a change inside `tx`: cut the open slips again; when other slips' money moves and the person has not said yes yet, undo and ask (B5) */
export async function repriceOrAsk(tx: Tx, confirmed: boolean, opts: { except?: string } = {}): Promise<Repriced> {
  const r = await repriceOpenLines(tx, opts);
  if (!confirmed && r.changed > 0) throw new Ask([changeNote(r.changed)]);
  return r;
}

/**
 * What a slip being typed would cost: its lines are put in the queue at its date and time (the saved copy of the
 * slip, when it is being edited, is left out) and cut into bills like any other. Nothing is written.
 */
export async function previewSlip(slip: { date: string; time: string | null; liters: number[]; excludeIssueId?: string }): Promise<{ parts: Part[]; amount: number | null; price: number | null }> {
  const at = `${slip.date}T${slip.time || "99:99"}`;
  const ids = slip.liters.map((_, i) => `new-${i}`);
  const { parts } = await compute(db, (all) => {
    const rest = all.filter((l) => l.issueId !== slip.excludeIssueId);
    const mine: LineRow[] = slip.liters.map((liters, i) => ({ lineId: ids[i], issueId: "new", liters, price: null, amount: null, closed: false, at }));
    const i = rest.findIndex((l) => l.at > at);
    return i < 0 ? [...rest, ...mine] : [...rest.slice(0, i), ...mine, ...rest.slice(i)];
  });
  const mine = ids.flatMap((id) => parts.get(id) ?? []);
  return { parts: mine, amount: partsAmount(mine), price: partsPrice(mine) };
}

/** fuel still in the truck by the bills it came from, and what it is worth (B8: it goes on to the next cycle at those prices) */
export async function stockByBill(q: Db = db) {
  const { left } = await compute(q);
  return { ...stockValue(left), lots: left.map((s) => ({ purchaseId: s.lot.id, at: s.lot.at, liters: s.liters, price: s.lot.price })) };
}

/** the parts of the lines of some slips, for the slip page and the invoice (B10) */
export async function partsOfLines(lineIds: string[], q: Db = db): Promise<Map<string, Part[]>> {
  return loadParts(q, lineIds);
}

