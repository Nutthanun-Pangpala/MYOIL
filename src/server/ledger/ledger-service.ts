import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, monthRange } from "@/domain/iso-date";
import { ledgerRows, ledgerSummary, type LedgerRow } from "@/domain/ledger-rows";
import { sumLiters } from "@/domain/money";
import type { Session } from "@/lib/session";
import { loadBills } from "@/server/prices/price-queries";

export type LedgerMonth = {
  month: string;
  /** last day shown: today for the current month, month end for a past one; null = month is in the future */
  through: string | null;
  rows: LedgerRow[];
  summary: ReturnType<typeof ledgerSummary>;
  /** opening balance of the month even when no row is shown yet */
  months: string[];
};

/** tank capacity in liters, null until the admin sets it */
export async function tankCapacity(): Promise<number | null> {
  return (await settings()).capacity;
}

async function settings() {
  const [s] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.id, 1));
  return { openingLiters: s?.openingLiters ?? 0, openingDate: s?.openingDate ?? null, capacity: s?.tankCapacityLiters ?? null };
}

/** fuel issued out per day: every issue that is not cancelled (rules.ts countsInBalance) */
async function issuesByDay(from: string, to: string) {
  return db
    .select({ date: schema.fuelIssues.issueDate, liters: sql<number>`sum(${schema.fuelIssueLines.liters})::float8` })
    .from(schema.fuelIssueLines)
    .innerJoin(schema.fuelIssues, eq(schema.fuelIssues.id, schema.fuelIssueLines.issueId))
    .where(and(isNull(schema.fuelIssues.cancelledAt), gte(schema.fuelIssues.issueDate, from), lte(schema.fuelIssues.issueDate, to)))
    .groupBy(schema.fuelIssues.issueDate);
}

async function purchasesByDay(from: string, to: string) {
  return db
    .select({
      date: schema.fuelPurchases.purchaseDate,
      liters: sql<number>`sum(${schema.fuelPurchases.liters})::float8`,
      amount: sql<number>`sum(${schema.fuelPurchases.amount})::float8`,
    })
    .from(schema.fuelPurchases)
    .where(and(isNull(schema.fuelPurchases.cancelledAt), gte(schema.fuelPurchases.purchaseDate, from), lte(schema.fuelPurchases.purchaseDate, to)))
    .groupBy(schema.fuelPurchases.purchaseDate);
}

/** first day the book counts from: the opening date, else the earliest record */
async function bookStart(openingDate: string | null, fallback: string): Promise<string> {
  if (openingDate) return openingDate;
  const [p] = await db.select({ d: sql<string | null>`min(${schema.fuelPurchases.purchaseDate})` }).from(schema.fuelPurchases)
    .where(isNull(schema.fuelPurchases.cancelledAt));
  const [i] = await db.select({ d: sql<string | null>`min(${schema.fuelIssues.issueDate})` }).from(schema.fuelIssues);
  return [p?.d, i?.d, fallback].filter((x): x is string => !!x).sort()[0];
}

/** the free-text หมายเหตุ of each day, by date */
export async function loadLedgerNotes(from: string, to: string): Promise<Record<string, string>> {
  const rows = await db.select().from(schema.ledgerNotes).where(and(gte(schema.ledgerNotes.noteDate, from), lte(schema.ledgerNotes.noteDate, to)));
  return Object.fromEntries(rows.map((r) => [r.noteDate, r.note]));
}

/** save, change or clear (empty text) the note of a day */
export async function setLedgerNote(session: Session, date: string, note: string): Promise<void> {
  const text = note.trim().slice(0, 300);
  if (!text) {
    await db.delete(schema.ledgerNotes).where(eq(schema.ledgerNotes.noteDate, date));
    return;
  }
  await db
    .insert(schema.ledgerNotes)
    .values({ noteDate: date, note: text, updatedBy: session.userId })
    .onConflictDoUpdate({ target: schema.ledgerNotes.noteDate, set: { note: text, updatedBy: session.userId, updatedAt: new Date() } });
}

export async function loadLedgerMonth(month: string, today: string): Promise<LedgerMonth> {
  const { start, end } = monthRange(month);
  const through = start > today ? null : end < today ? end : today;
  const [cfg, months] = await Promise.all([settings(), ledgerMonths(today)]);
  if (!through) return { month, through, rows: [], summary: ledgerSummary([]), months };

  const from = await bookStart(cfg.openingDate, start);
  const [purchases, issues, prices, checks] = await Promise.all([
    purchasesByDay(from, through),
    issuesByDay(from, through),
    loadBills(),
    db.select().from(schema.stockChecks).where(and(gte(schema.stockChecks.checkDate, start), lte(schema.stockChecks.checkDate, through))),
  ]);

  const all = ledgerRows({
    openingLiters: cfg.openingLiters,
    from: from > start ? start : from,
    to: through,
    purchases: purchases.map((p) => ({ date: p.date, liters: p.liters, amount: p.amount })),
    issues,
    prices,
    checks: checks.map((c) => ({ date: c.checkDate, liters: c.measuredLiters })),
  });
  const rows = all.filter((r) => r.date >= start);
  return { month, through, rows, summary: ledgerSummary(rows), months };
}

/** months to offer in the picker: from the first record to the current month, newest first */
export async function ledgerMonths(today: string): Promise<string[]> {
  const first = (await bookStart((await settings()).openingDate, today)).slice(0, 7);
  const out: string[] = [];
  for (let m = today.slice(0, 7); m >= first && out.length < 36; ) {
    out.push(m);
    m = addDays(`${m}-01`, -1).slice(0, 7);
  }
  return out;
}

/** liters in the truck at the end of `date` (sidebar). null for people who may not see stock. */
export async function stockOn(date: string): Promise<{ liters: number; percent: number | null }> {
  const cfg = await settings();
  const from = cfg.openingDate ?? "0001-01-01";
  const [p] = await db
    .select({ l: sql<number>`coalesce(sum(${schema.fuelPurchases.liters}), 0)::float8` })
    .from(schema.fuelPurchases)
    .where(and(isNull(schema.fuelPurchases.cancelledAt), gte(schema.fuelPurchases.purchaseDate, from), lte(schema.fuelPurchases.purchaseDate, date)));
  const [i] = await db
    .select({ l: sql<number>`coalesce(sum(${schema.fuelIssueLines.liters}), 0)::float8` })
    .from(schema.fuelIssueLines)
    .innerJoin(schema.fuelIssues, eq(schema.fuelIssues.id, schema.fuelIssueLines.issueId))
    .where(and(isNull(schema.fuelIssues.cancelledAt), gte(schema.fuelIssues.issueDate, from), lte(schema.fuelIssues.issueDate, date)));
  const liters = sumLiters([cfg.openingLiters, p?.l ?? 0, -(i?.l ?? 0)]);
  return { liters, percent: cfg.capacity ? (liters / cfg.capacity) * 100 : null };
}

/** save, change or clear the amount measured in the truck on a date */
export async function setStockCheck(session: Session, date: string, liters: number | null): Promise<void> {
  if (liters === null) {
    await db.delete(schema.stockChecks).where(eq(schema.stockChecks.checkDate, date));
    return;
  }
  await db
    .insert(schema.stockChecks)
    .values({ checkDate: date, measuredLiters: liters, createdBy: session.userId })
    .onConflictDoUpdate({ target: schema.stockChecks.checkDate, set: { measuredLiters: liters, createdBy: session.userId } });
}
