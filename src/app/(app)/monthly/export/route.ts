import ExcelJS from "exceljs";
import { isMonth } from "@/domain/iso-date";
import { thaiMonthShort } from "@/domain/thai-date";
import { getSession } from "@/lib/session";
import { loadMonthly } from "@/server/monthly/monthly-service";

/** ตารางรายเดือน as .xlsx — same numbers as the screen (all projects, or one project's machines) */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new Response("forbidden", { status: 403 });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const q = new URL(req.url).searchParams;
  const month = isMonth(q.get("month") ?? "") ? q.get("month")! : today.slice(0, 7);
  const v = await loadMonthly(session, month, today, q.get("project") || null);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`ตารางรายเดือน ${thaiMonthShort(`${month}-01`)}`.slice(0, 31));
  const m = (v.all ?? v.one)!;
  const days = Array.from({ length: m.days }, (_, i) => i + 1);
  const blank = (x: number) => (x === 0 ? null : x);

  if (v.one) {
    ws.addRow(["ลำดับ", "รายการเครื่องจักร", "รหัสทรัพย์สิน", ...days, "ปริมาณรวม"]).font = { bold: true };
    for (const r of v.one.rows) ws.addRow([r.no, r.label, r.isRented ? "เช่า" : (r.assetCode ?? ""), ...r.days.map(blank), r.total]);
    ws.addRow(["", "รวมต่อวัน", "", ...m.dayTotals.map(blank), m.grandTotal]).font = { bold: true };
  } else {
    ws.addRow(["โครงการ", ...days, "รวม (ลิตร)"]).font = { bold: true };
    for (const r of m.rows) ws.addRow([r.label, ...r.days.map(blank), r.total]);
    ws.addRow(["รวมต่อวัน", ...m.dayTotals.map(blank), m.grandTotal]).font = { bold: true };
  }
  ws.views = [{ state: "frozen", xSplit: v.one ? 3 : 1, ySplit: 1 }];
  ws.columns.forEach((c, i) => {
    c.width = i === 1 && v.one ? 20 : i === 0 && !v.one ? 16 : 9;
    c.numFmt = "#,##0.##";
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="myoil-monthly-${month}.xlsx"`,
    },
  });
}
