import ExcelJS from "exceljs";
import { isMonth } from "@/domain/iso-date";
import { thaiLong, thaiMonthShort } from "@/domain/thai-date";
import { canOpen } from "@/lib/nav";
import { getSession } from "@/lib/session";
import { loadLedgerMonth, loadLedgerNotes } from "@/server/ledger/ledger-service";

/** สมุดคงเหลือ of one month as .xlsx — same rows and numbers as the screen */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !canOpen(session.role, "/ledger")) return new Response("forbidden", { status: 403 });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const q = new URL(req.url).searchParams.get("month") ?? "";
  const month = isMonth(q) ? q : today.slice(0, 7);
  const { rows, summary, through } = await loadLedgerMonth(month, today);

  const notes = rows.length ? await loadLedgerNotes(rows[0].date, rows[rows.length - 1].date) : {};
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`สมุดคงเหลือ ${thaiMonthShort(`${month}-01`)}`.slice(0, 31));
  ws.addRow(["วัน/เดือน/ปี", "จำนวนเงินเติม", "ราคา/ลิตร", "เติมเข้า/ลิตร", "ออก/ลิตร", "คงเหลือ/ลิตร", "วัดได้จริง/ลิตร", "ส่วนต่าง", "หมายเหตุ"]).font = { bold: true };
  for (const r of rows) {
    ws.addRow([thaiLong(r.date), r.purchaseAmount, r.price, r.in || null, r.out || null, r.closing, r.measured, r.diff, notes[r.date] ?? ""]);
  }
  ws.addRow([`รวมถึง ${thaiLong(through ?? month + "-01")}`, summary.amount, null, summary.in, summary.out, summary.closing]).font = { bold: true };
  ws.columns.forEach((c, i) => {
    c.width = i === 0 ? 18 : 16;
    if (i >= 1 && i <= 7) c.numFmt = "#,##0.00";
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="myoil-ledger-${month}.xlsx"`,
    },
  });
}
