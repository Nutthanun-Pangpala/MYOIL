import ExcelJS from "exceljs";
import { isIsoDate } from "@/domain/iso-date";
import { canOpen } from "@/lib/nav";
import { getSession } from "@/lib/session";
import { projectOptions } from "@/server/issues/issue-service";
import { loadMachineReport } from "@/server/reports/machine-report";

/** รายงานตามเครื่องจักร as .xlsx: one row per fill, same filters and numbers as the screen */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !canOpen(session.role, "/machine-report")) return new Response("forbidden", { status: 403 });
  const q = new URL(req.url).searchParams;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if (!isIsoDate(from) || !isIsoDate(to)) return new Response("bad dates", { status: 400 });
  const projects = await projectOptions(session);
  const project = projects.find((p) => p.id === q.get("project")) ?? null;
  const report = await loadMachineReport(session, { from, to, projectId: project?.id ?? null });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("รายงานเครื่องจักร");
  ws.addRow([`รายงานตามเครื่องจักร ${project ? project.refCode : "ทุกโครงการ"} ${from} ถึง ${to}`]).font = { bold: true };
  ws.addRow(["เครื่องจักร", "วันที่", "เล่มที่", "เลขที่", "โครงการ", "ที่มา", "ลิตร", "ยอดเงิน (บาท)"]).font = { bold: true };
  for (const r of report.rows) {
    for (const f of r.fills) ws.addRow([r.label, f.date, f.bookNo, f.docNo, f.projectRef, f.source === "mobile" ? "มือถือ" : "กระดาษ", f.liters, f.amount ?? "รอราคา"]);
    ws.addRow([`รวม ${r.label}`, "", "", "", "", `${r.fills.length} ครั้ง`, r.liters, r.amount]).font = { bold: true };
  }
  ws.addRow(["รวมทั้งหมด", "", "", "", "", `${report.fills} ครั้ง`, report.liters, report.amount]).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 2 }];
  ws.columns.forEach((c, i) => {
    c.width = [22, 12, 8, 10, 12, 10, 12, 16][i];
    if (i === 6 || i === 7) c.numFmt = "#,##0.00";
  });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="myoil-machines-${from}-${to}.xlsx"`,
    },
  });
}
