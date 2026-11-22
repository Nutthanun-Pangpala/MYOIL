import Link from "next/link";
import { thaiMonth, thaiShort } from "@/domain/thai-date";
import { formatBaht, formatLiters } from "@/lib/format";
import type { InvoiceDetail } from "@/server/cycles/cycle-service";

/** the printed form: A4 portrait, black and white. Layout follows design 6.10. */
export function InvoiceSheet({ inv, links = true }: { inv: InvoiceDetail; links?: boolean }) {
  const sign = (label: string[]) => (
    <div className="flex flex-col gap-0.5 text-center text-[12px]">
      <div className="h-11 border-b border-ink" />
      {label.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
  return (
    <div className="invoice-sheet flex min-h-[1040px] w-[760px] flex-col gap-4 border border-idle bg-white p-11 text-[13px]">
      <div className="text-center font-display text-xl font-medium">ใบแจ้งค่าใช้จ่าย (น้ำมันเชื้อเพลิง)</div>
      <div className="text-center">สโตร์กลาง U WORK 999</div>
      <div className="flex flex-wrap justify-between gap-x-6 gap-y-1">
        <span>
          ผู้ใช้บริการ {inv.project.ref} ({inv.project.name})
        </span>
        <span>เดือน{thaiMonth(inv.cycle.start)}</span>
      </div>

      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {["ลำดับ", "วันที่", "เล่มที่", "เลขที่", "รายการ/รหัส", "ค่าน้ำมัน/ลิตร", "จำนวนลิตร", "จำนวนเงิน", "ปรับงบลง PSY69"].map((h) => (
              <th key={h} className="border border-ink bg-[#4d4d4d] px-2 py-1.5 text-center font-medium text-white">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={l.slipId} className="align-top">
              <td className="num border border-ink px-2 py-1.5 text-right">{i + 1}</td>
              <td className="border border-ink px-2 py-1.5">{thaiShort(l.date)}</td>
              <td className="border border-ink px-2 py-1.5">{l.bookNo}</td>
              <td className="border border-ink px-2 py-1.5">
                {links ? (
                  <Link href={`/issues/${l.slipId}`} className="text-earth underline print:no-underline">
                    {l.docNo}
                  </Link>
                ) : (
                  l.docNo
                )}
              </td>
              <td className="border border-ink px-2 py-1.5">{l.machines}</td>
              <td className="num border border-ink px-2 py-1.5 text-right">{l.price === null ? "รอราคา" : formatBaht(l.price)}</td>
              <td className="num border border-ink px-2 py-1.5 text-right">{formatLiters(l.liters)}</td>
              <td className="num border border-ink px-2 py-1.5 text-right">{l.amount === null ? "รอราคา" : formatBaht(l.amount)}</td>
              <td className="border border-ink px-2 py-1.5" />
            </tr>
          ))}
          <tr>
            <td colSpan={6} className="border border-ink px-2 py-1.5 text-right font-semibold">
              ยอดรวม
            </td>
            <td className="num border border-ink px-2 py-1.5 text-right font-semibold underline underline-offset-4">{formatLiters(inv.liters)}</td>
            <td className="num border border-ink px-2 py-1.5 text-right font-semibold underline underline-offset-4">
              {inv.pendingPrice ? `${formatBaht(inv.amount)} + รอราคา` : formatBaht(inv.amount)}
            </td>
            <td className="border border-ink px-2 py-1.5 text-center">{inv.totalRowCode}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-auto flex flex-col gap-7">
        <div className="grid grid-cols-3 gap-6">
          {sign(["ADMIN สโตร์"])}
          {sign(["(ADMIN หน่วยงาน)", "ผู้ตรวจสอบ"])}
          {sign(["ผู้จัดการโครงการ PM"])}
        </div>
        <div className="grid grid-cols-2 gap-6 px-[15%]">
          {sign(["ผู้จัดทำ"])}
          {sign(["ผู้จัดการโครงการ"])}
        </div>
      </div>
    </div>
  );
}
