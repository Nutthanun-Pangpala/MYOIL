import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

const { fuelIssues, fuelIssueLines, machines, projects } = schema;

export type DriverSlip = {
  id: string;
  ref: string;
  no: string;
  code: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  signed: boolean;
  receiverName: string | null;
  unsignedReason: string | null;
  cancelled: boolean;
  lines: { id: string; machine: string; type: string | null; liters: number }[];
};

/** a slip made on the phone, as the driver's own "ใบจ่ายของ …" page shows it (paper slips are the office's) */
export async function driverSlip(id: string): Promise<DriverSlip | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [h] = await db.select({ i: fuelIssues, code: projects.refCode }).from(fuelIssues).innerJoin(projects, eq(projects.id, fuelIssues.projectId)).where(eq(fuelIssues.id, id)).limit(1);
  if (!h || h.i.source !== "mobile" || !h.i.externalRef) return null;
  const lines = await db
    .select({ id: fuelIssueLines.id, machine: machines.code, type: machines.type, liters: fuelIssueLines.liters })
    .from(fuelIssueLines)
    .innerJoin(machines, eq(machines.id, fuelIssueLines.machineId))
    .where(eq(fuelIssueLines.issueId, id))
    .orderBy(asc(fuelIssueLines.position));
  return {
    id: h.i.id,
    ref: h.i.externalRef,
    no: `${h.i.bookNo}/${h.i.docNo}`,
    code: h.code,
    date: h.i.issueDate,
    timeIn: h.i.timeIn,
    timeOut: h.i.timeOut,
    signed: h.i.receivedSigned,
    receiverName: h.i.receiverName,
    unsignedReason: h.i.unsignedReason,
    cancelled: h.i.cancelledAt !== null,
    lines,
  };
}

/** machine id → the admin's type ("รถขุด", "รถ", …), for the little pictures of the driver's lists */
export async function machineTypes(): Promise<Map<string, string | null>> {
  const rows = await db.select({ id: machines.id, type: machines.type }).from(machines);
  return new Map(rows.map((r) => [r.id, r.type]));
}
