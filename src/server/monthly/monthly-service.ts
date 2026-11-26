import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { countsSql } from "@/server/issues/billable";
import { monthRange } from "@/domain/iso-date";
import { byMachine, byProject, type MonthlyLine } from "@/domain/monthly-matrix";
import type { Session } from "@/lib/session";
import { ledgerMonths } from "@/server/ledger/ledger-service";
import { visibleProjectIds } from "@/server/projects/project-scope";

/** every issue line of the month that counts (not cancelled), limited to the projects this person may see */
async function monthLines(session: Session, month: string): Promise<MonthlyLine[]> {
  const { start, end } = monthRange(month);
  const ids = await visibleProjectIds(session);
  if (ids && ids.length === 0) return [];
  const rows = await db
    .select({
      date: schema.fuelIssues.issueDate,
      projectKey: schema.projects.id,
      projectLabel: schema.projects.refCode,
      machineKey: schema.machines.id,
      machineLabel: schema.machines.code,
      assetCode: schema.machines.assetCode,
      isRented: schema.machines.isRented,
      liters: schema.fuelIssueLines.liters,
    })
    .from(schema.fuelIssueLines)
    .innerJoin(schema.fuelIssues, eq(schema.fuelIssues.id, schema.fuelIssueLines.issueId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.fuelIssues.projectId))
    .innerJoin(schema.machines, eq(schema.machines.id, schema.fuelIssueLines.machineId))
    .where(
      and(
        countsSql,
        gte(schema.fuelIssues.issueDate, start),
        lte(schema.fuelIssues.issueDate, end),
        ids ? inArray(schema.fuelIssues.projectId, ids) : undefined,
      ),
    );
  return rows;
}

export type MonthlyView = Awaited<ReturnType<typeof loadMonthly>>;

/** `projectId` empty = every project × day; set = that project's machines × day */
export async function loadMonthly(session: Session, month: string, today: string, projectId: string | null) {
  const [lines, months, projects] = await Promise.all([monthLines(session, month), ledgerMonths(today), projectOptions(session)]);
  const monthOptions = months.includes(month) ? months : [month, ...months];
  const picked = projectId && projects.some((p) => p.id === projectId) ? projectId : null;
  return {
    month,
    months: monthOptions,
    projects,
    projectId: picked,
    all: picked ? null : byProject(lines, month),
    one: picked ? byMachine(lines, picked, month) : null,
  };
}

async function projectOptions(session: Session) {
  const ids = await visibleProjectIds(session);
  if (ids && ids.length === 0) return [];
  return db
    .select({ id: schema.projects.id, code: schema.projects.refCode })
    .from(schema.projects)
    .where(ids ? inArray(schema.projects.id, ids) : eq(schema.projects.isActive, true))
    .orderBy(asc(schema.projects.refCode));
}
