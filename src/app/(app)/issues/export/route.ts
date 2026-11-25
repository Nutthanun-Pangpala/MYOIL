import ExcelJS from "exceljs";
import { canOpen } from "@/lib/nav";
import { getSession } from "@/lib/session";
import { listIssues } from "@/server/issues/issue-service";
import { issueFiltersFrom } from "../list-filters";

/** รายการใบจ่าย as .xlsx — same filters and same numbers as the list screen */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !canOpen(session.role, "/issues")) return new Response("forbidden", { status: 403 });
  const q = new URL(req.url).searchParams;
  const { badDate: _bad, ...filters } = issueFiltersFrom((k) => q.get(k)?.trim() ?? "");
  const rows = await listIssues(session, filters);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("ใบจ่ายน้ำมัน");
  ws.addRow(["วันที่", "เล่มที่", "เลขที่", "โครงการ", "เครื่องจักร", "ลิตร", "จำนวนเงิน (บาท)", "สถานะ"]).font = { bold: true };
  for (const r of rows) {
    const status = r.badges.includes("cancelled") ? "ยกเลิก" : r.badges.includes("unsigned") ? "ยังไม่เซ็นรับ" : "เซ็นรับแล้ว";
    ws.addRow([r.issueDate, r.bookNo, r.docNo, r.projectRef, r.machines.join(", "), r.liters, r.amount ?? "รอราคา", status]);
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.columns.forEach((c, i) => {
    c.width = [12, 8, 10, 12, 28, 12, 16, 14][i];
    if (i === 5 || i === 6) c.numFmt = "#,##0.00";
  });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="myoil-issues.xlsx"',
    },
  });
}
