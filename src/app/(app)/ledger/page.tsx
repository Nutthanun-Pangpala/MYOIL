import { redirect } from "next/navigation";
import { MonthSelect } from "@/components/month-select";
import { Card, StateBox, linkButton } from "@/components/ui";
import { isMonth } from "@/domain/iso-date";
import { thaiLong, thaiShort } from "@/domain/thai-date";
import { formatBaht } from "@/lib/format";
import { canOpen } from "@/lib/nav";
import { canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { loadLedgerMonth, loadLedgerNotes } from "@/server/ledger/ledger-service";
import { stockByBill } from "@/server/prices/fifo-service";
import { MeasuredInput } from "./measured-input";
import { NoteInput } from "./note-input";

export const metadata = { title: "สมุดคงเหลือ" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const DASH = "–";

export default async function LedgerPage({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  if (!canOpen(session.role, "/ledger")) redirect("/");
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const month = isMonth(one(sp.month)) ? one(sp.month) : today.slice(0, 7);
  const writer = canWriteFuel(session);

  const { rows, summary, through, months } = await loadLedgerMonth(month, today);
  const notes = rows.length ? await loadLedgerNotes(rows[0].date, rows[rows.length - 1].date) : {};
  const monthOptions = months.includes(month) ? months : [month, ...months];
  // what is in the truck now, by the bill it came from: the oldest is used next (brief §14)
  const left = await stockByBill();

  const stat = (label: string, liters: number) => (
    <div className="flex flex-[1_1_180px] flex-col gap-0.5">
      <span className="text-muted">{label}</span>
      <span className="num text-left font-display text-[26px] font-medium leading-snug">
        {formatBaht(liters)} <span className="text-[15px] font-normal">ลิตร</span>
      </span>
    </div>
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-semibold leading-snug">สมุดคงเหลือ</h1>
          <p className="text-muted">สรุปยอดการเบิก-จ่ายน้ำมันเชื้อเพลิงของรถเติมน้ำมัน รายวัน</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelect id="lg-month" path="/ledger" month={month} months={monthOptions} />
          <a href={`/ledger/export?month=${month}`} className={`${linkButton("secondary")} self-end`}>
            ส่งออก Excel
          </a>
        </div>
      </header>

      <Card className="px-6 py-5">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          {stat("ยกมา", summary.opening)}
          {stat("เติมเข้ารวม", summary.in)}
          {stat("จ่ายออกรวม", summary.out)}
          {stat("คงเหลือ", summary.closing)}
        </div>
      </Card>

      <Card data-testid="stock-by-bill" className="flex flex-col gap-2 px-6 py-5">
        <h2 className="font-display text-lg font-medium leading-snug">น้ำมันที่เหลือในรถตอนนี้ แยกตามบิลซื้อ</h2>
        {left.lots.length === 0 ? (
          <span className="text-muted">ไม่มีน้ำมันของบิลใดเหลืออยู่</span>
        ) : (
          <>
            <span>
              รวม {formatBaht(left.liters)} ลิตร มูลค่า {formatBaht(left.amount)} บาท
            </span>
            <ul className="flex flex-col gap-0.5 text-[14px] text-muted">
              {left.lots.map((l, i) => (
                <li key={l.purchaseId ?? "opening"}>
                  {i === 0 ? "ใช้ถัดไป: " : ""}
                  {l.purchaseId === null ? "ยอดยกมา" : `บิลซื้อ ${thaiShort(l.at.slice(0, 10))} ${l.at.slice(11)} น.`} เหลือ {formatBaht(l.liters)} ลิตร {l.price === null ? "รอราคา" : `× ${formatBaht(l.price)} บาท`}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {rows.some((r) => r.negative) && (
        <p role="status" className="rounded-control border border-repair bg-repair-soft px-4 py-3 text-sm">
          ยอดคงเหลือติดลบ ส่วนใหญ่แปลว่ายังไม่ได้คีย์ซื้อน้ำมันเข้า ตรวจว่าบันทึกซื้อน้ำมันเข้าครบหรือยัง
        </p>
      )}

      <Card className="p-6">
        {rows.length === 0 ? (
          <StateBox title="ยังไม่มีข้อมูลของเดือนนี้">สมุดเริ่มนับจากวันเริ่มใช้ที่ตั้งไว้ในหน้าตั้งค่า รถเติมน้ำมัน</StateBox>
        ) : (
          <div className="overflow-x-auto">
            <table className="t">
              <thead>
                <tr>
                  <th>วัน/เดือน/ปี</th>
                  <th className="n">จำนวนเงินเติม</th>
                  <th className="n">ราคาบิลล่าสุด</th>
                  <th className="n">เติมเข้า/ลิตร</th>
                  <th className="n">ออก/ลิตร</th>
                  <th className="n">คงเหลือ/ลิตร</th>
                  <th>วัดได้จริง/ลิตร</th>
                  <th className="n">ส่วนต่าง</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date}>
                    <td className="whitespace-nowrap">{thaiLong(r.date)}</td>
                    <td className="n">{r.purchaseAmount === null ? DASH : formatBaht(r.purchaseAmount)}</td>
                    <td className="n">{r.price === null ? DASH : formatBaht(r.price)}</td>
                    <td className="n">{r.in === 0 ? DASH : formatBaht(r.in)}</td>
                    <td className="n">
                      {r.out === 0 ? (
                        DASH
                      ) : (
                        <a href={`/issues?from=${r.date}&to=${r.date}`} className="text-earth hover:text-ink">
                          {formatBaht(r.out)}
                        </a>
                      )}
                    </td>
                    <td className="n">
                      {r.negative ? <span className="font-semibold text-negative">{formatBaht(r.closing)} ติดลบ</span> : formatBaht(r.closing)}
                    </td>
                    <td>
                      {writer ? (
                        <MeasuredInput key={`${r.date}-${r.measured}`} date={r.date} label={`ยอดที่วัดได้จริง วันที่ ${thaiLong(r.date)}`} value={r.measured} />
                      ) : r.measured === null ? null : (
                        <span className="num">{formatBaht(r.measured)}</span>
                      )}
                    </td>
                    <td className="n">
                      {r.diff === null ? null : r.diff === 0 ? (
                        "ตรงกัน"
                      ) : (
                        <span className="font-semibold text-negative">{formatBaht(r.diff)} ไม่ตรง</span>
                      )}
                    </td>
                    <td>
                      {writer ? (
                        <NoteInput key={`${r.date}-${notes[r.date] ?? ""}`} date={r.date} label={`หมายเหตุ วันที่ ${thaiLong(r.date)}`} value={notes[r.date] ?? ""} />
                      ) : (
                        notes[r.date] ?? null
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>รวมถึง {thaiLong(through ?? rows[rows.length - 1].date)}</td>
                  <td className="n">{formatBaht(summary.amount)}</td>
                  <td />
                  <td className="n">{formatBaht(summary.in)}</td>
                  <td className="n">{formatBaht(summary.out)}</td>
                  <td className="n">{formatBaht(summary.closing)}</td>
                  <td />
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <p className="text-sm text-muted">กดตัวเลขในคอลัมน์ ออก/ลิตร เพื่อดูใบจ่ายของวันนั้น ช่องวัดได้จริงไม่บังคับ</p>
    </>
  );
}
