import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { monthRange } from "@/domain/iso-date";
import { projectBreakdown, tankLevel } from "@/domain/overview";
import { priceOn } from "@/domain/price";
import { sumLiters } from "@/domain/money";
import { canOpen } from "@/lib/nav";
import type { Session } from "@/lib/session";
import { ledgerMonths, loadLedgerMonth, stockOn } from "@/server/ledger/ledger-service";
import { visibleProjectIds } from "@/server/projects/project-scope";
import { billableSql } from "@/server/issues/billable";

/** everything the overview shows; parts a role may not see come back null */
export async function loadOverview(session: Session, month: string, today: string) {
  const ids = await visibleProjectIds(session);
  const none = !!ids && ids.length === 0;
  const scope = ids ? inArray(schema.fuelIssues.projectId, ids) : undefined;
  const { start, end } = monthRange(month);

  const lines = none
    ? []
    : await db
        .select({
          issueId: schema.fuelIssues.id,
          date: schema.fuelIssues.issueDate,
          projectKey: schema.projects.id,
          projectLabel: schema.projects.refCode,
          liters: schema.fuelIssueLines.liters,
          amount: schema.fuelIssueLines.amount,
          signed: billableSql,
        })
        .from(schema.fuelIssueLines)
        .innerJoin(schema.fuelIssues, eq(schema.fuelIssues.id, schema.fuelIssueLines.issueId))
        .innerJoin(schema.projects, eq(schema.projects.id, schema.fuelIssues.projectId))
        .where(and(isNull(schema.fuelIssues.cancelledAt), gte(schema.fuelIssues.issueDate, start), lte(schema.fuelIssues.issueDate, end), scope));

  const breakdown = projectBreakdown(lines);
  const todaySlips = new Set(lines.filter((l) => l.date === today).map((l) => l.issueId)).size;

  const [prices, months, [cfg], activeProjects] = await Promise.all([
    db.select().from(schema.fuelPrices).orderBy(asc(schema.fuelPrices.priceDate)),
    ledgerMonths(today),
    db.select().from(schema.appSettings).where(eq(schema.appSettings.id, 1)),
    db.select({ id: schema.projects.id }).from(schema.projects).where(and(eq(schema.projects.isActive, true), ids ? inArray(schema.projects.id, ids) : undefined)),
  ]);
  const price = priceOn(prices.map((p) => ({ date: p.priceDate, pricePerLiter: p.pricePerLiter })), today);

  // stock and the ledger-based to-do items: only for roles that may open the ledger
  let tank: (ReturnType<typeof tankLevel> & { liters: number; capacity: number | null; inToday: number; outToday: number }) | null = null;
  let negative: { days: number; first: string; closing: number } | null = null;
  if (canOpen(session.role, "/ledger")) {
    const [s, cur] = await Promise.all([stockOn(today), loadLedgerMonth(today.slice(0, 7), today)]);
    const row = cur.rows.find((r) => r.date === today);
    tank = {
      ...tankLevel(s.liters, cfg?.tankCapacityLiters ?? null, cfg?.lowLevelLiters ?? null),
      liters: s.liters,
      capacity: cfg?.tankCapacityLiters ?? null,
      inToday: row?.in ?? 0,
      outToday: row?.out ?? 0,
    };
    const neg = cur.rows.filter((r) => r.negative);
    if (neg.length) negative = { days: neg.length, first: neg[0].date, closing: neg[0].closing };
  }

  // slips whose paper copy has no signature yet — a writer's follow-up (they are not in the invoice)
  let unsigned: { slips: number; liters: number } | null = null;
  if (session.role === "store_admin" || session.role === "system_admin") {
    const u = await db
      .select({ id: schema.fuelIssues.id, liters: schema.fuelIssueLines.liters })
      .from(schema.fuelIssueLines)
      .innerJoin(schema.fuelIssues, eq(schema.fuelIssues.id, schema.fuelIssueLines.issueId))
      .where(and(isNull(schema.fuelIssues.cancelledAt), eq(schema.fuelIssues.receivedSigned, false)));
    unsigned = { slips: new Set(u.map((x) => x.id)).size, liters: sumLiters(u.map((x) => x.liters)) };
  }

  return {
    month,
    months: months.includes(month) ? months : [month, ...months],
    breakdown,
    todaySlips,
    price,
    idleProjects: Math.max(0, activeProjects.length - breakdown.rows.length),
    tank,
    negative,
    unsigned,
  };
}
