import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { sumAmounts, sumLiters } from "@/domain/money";
import type { Session } from "@/lib/session";
import { visibleProjectIds } from "@/server/projects/project-scope";

const { fuelIssues, fuelIssueLines, fuelIssueLinePhotos, machines, projects } = schema;

export type Fill = {
  lineId: string;
  issueId: string;
  date: string;
  bookNo: string;
  docNo: string;
  projectRef: string;
  source: "paper" | "mobile";
  pendingReview: boolean;
  hasPhoto: boolean;
  liters: number;
  amount: number | null;
};

export type MachineRow = { machineId: string; label: string; fills: Fill[]; liters: number; amount: number; unpriced: number };

export type MachineReport = { rows: MachineRow[]; fills: number; liters: number; amount: number; pendingReview: number };

/**
 * design "รายงานตามเครื่องจักร": which machines a project filled, how often and how much, each fill with its meter photo.
 * Counts every slip that is not cancelled (same rule as the monthly table), only projects this person may see.
 */
export async function loadMachineReport(session: Session, f: { from: string; to: string; projectId: string | null }): Promise<MachineReport> {
  const scope = await visibleProjectIds(session);
  if ((scope && scope.length === 0) || (f.projectId && scope && !scope.includes(f.projectId))) return { rows: [], fills: 0, liters: 0, amount: 0, pendingReview: 0 };
  const lines = await db
    .select({
      lineId: fuelIssueLines.id,
      issueId: fuelIssues.id,
      date: fuelIssues.issueDate,
      bookNo: fuelIssues.bookNo,
      docNo: fuelIssues.docNo,
      source: fuelIssues.source,
      reviewStatus: fuelIssues.reviewStatus,
      projectRef: projects.refCode,
      machineId: machines.id,
      code: machines.code,
      isRented: machines.isRented,
      liters: fuelIssueLines.liters,
      amount: fuelIssueLines.amount,
      photo: fuelIssueLinePhotos.lineId,
    })
    .from(fuelIssueLines)
    .innerJoin(fuelIssues, eq(fuelIssues.id, fuelIssueLines.issueId))
    .innerJoin(projects, eq(projects.id, fuelIssues.projectId))
    .innerJoin(machines, eq(machines.id, fuelIssueLines.machineId))
    .leftJoin(fuelIssueLinePhotos, eq(fuelIssueLinePhotos.lineId, fuelIssueLines.id))
    .where(
      and(
        isNull(fuelIssues.cancelledAt),
        gte(fuelIssues.issueDate, f.from),
        lte(fuelIssues.issueDate, f.to),
        f.projectId ? eq(fuelIssues.projectId, f.projectId) : scope ? inArray(fuelIssues.projectId, scope) : undefined,
      ),
    )
    .orderBy(asc(fuelIssues.issueDate), asc(fuelIssues.bookNo), asc(fuelIssues.docNo), asc(fuelIssueLines.position));

  const by = new Map<string, MachineRow>();
  for (const l of lines) {
    const row = by.get(l.machineId) ?? { machineId: l.machineId, label: l.isRented ? `${l.code} เช่า` : l.code, fills: [], liters: 0, amount: 0, unpriced: 0 };
    row.fills.push({
      lineId: l.lineId,
      issueId: l.issueId,
      date: l.date,
      bookNo: l.bookNo,
      docNo: l.docNo,
      projectRef: l.projectRef,
      source: l.source === "mobile" ? "mobile" : "paper",
      pendingReview: l.source === "mobile" && l.reviewStatus === "pending_review",
      hasPhoto: l.photo !== null,
      liters: l.liters,
      amount: l.amount,
    });
    by.set(l.machineId, row);
  }
  const rows = [...by.values()].map((r) => ({
    ...r,
    liters: sumLiters(r.fills.map((x) => x.liters)),
    amount: sumAmounts(r.fills.map((x) => x.amount ?? 0)),
    unpriced: r.fills.filter((x) => x.amount === null).length,
  }));
  rows.sort((a, b) => b.liters - a.liters || a.label.localeCompare(b.label, "th"));
  const pending = new Set(lines.filter((l) => l.source === "mobile" && l.reviewStatus === "pending_review").map((l) => l.issueId)).size;
  return {
    rows,
    fills: lines.length,
    liters: sumLiters(rows.map((r) => r.liters)),
    amount: sumAmounts(rows.map((r) => r.amount)),
    pendingReview: pending,
  };
}
