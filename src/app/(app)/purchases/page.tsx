import Link from "next/link";
import { MonthSelect } from "@/components/month-select";
import { Card, linkButton } from "@/components/ui";
import { isMonth, monthRange } from "@/domain/iso-date";
import { sumAmounts, sumLiters } from "@/domain/money";
import { thaiMonthShort, thaiShort } from "@/domain/thai-date";
import { formatBaht } from "@/lib/format";
import { canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { loadPurchasePage } from "@/server/purchases/purchase-service";
import { PurchasePanel } from "./purchase-panel";
import { PurchaseRowActions } from "./row-actions";

export const metadata = { title: "ซื้อน้ำมันเข้า" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PurchasesPage({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const month = isMonth(one(sp.month)) ? one(sp.month) : today.slice(0, 7);
  const writer = canWriteFuel(session);

  const { purchases, periods, months } = await loadPurchasePage(month, today);
  const { start, end } = monthRange(month);
  const monthName = thaiMonthShort(`${month}-01`);
  const inMonth = periods.filter((p) => p.from <= end && (p.to === null || p.to >= start)); // prices in force during this month
  const shown = [...purchases].reverse(); // newest first, like the design
  const live = purchases.filter((p) => !p.cancelled); // a cancelled purchase counts nowhere
  const totalLiters = sumLiters(live.map((p) => p.liters));
  const totalAmount = sumAmounts(live.map((p) => p.amount));

  const mode = writer ? one(sp.new) : "";
  const editing = writer ? purchases.find((p) => p.id === one(sp.edit) && !p.cancelled && !p.lock) : undefined;
  const editDate = one(sp.date);
  const editPrice = periods.find((p) => p.date === editDate)?.pricePerLiter;
  const here = `/purchases?month=${month}`;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-semibold leading-snug">ซื้อน้ำมันเข้า</h1>
          <p className="text-muted">น้ำมันที่เติมเข้ารถเติมน้ำมัน และราคาประจำวัน</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelect id="pu-month" path="/purchases" month={month} months={months} />
          {writer && (
            <>
              <Link href={`${here}&new=price`} className={`${linkButton("secondary")} self-end`}>
                ตั้งราคาของวันที่ไม่มีการซื้อ
              </Link>
              <Link href={`${here}&new=purchase`} className={`${linkButton("secondary")} self-end`}>
                บันทึกการซื้อ
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <Card className="p-6">
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-medium leading-snug">การซื้อ {monthName}</h2>
              {shown.length === 0 ? (
                <p className="py-6 text-center text-muted">ยังไม่มีการซื้อในเดือนนี้</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="t">
                    <thead>
                      <tr>
                        <th>วันที่</th>
                        <th className="n">เติมเข้า (ลิตร)</th>
                        <th className="n">ราคา/ลิตร (บาท)</th>
                        <th className="n">จำนวนเงิน (บาท)</th>
                        <th>เลขที่บิล</th>
                        <th>หมายเหตุ</th>
                        {writer && <th>จัดการ</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((p) => (
                        <tr key={p.id} className={p.cancelled ? "text-muted line-through" : undefined}>
                          <td className="whitespace-nowrap">{thaiShort(p.date)}</td>
                          <td className="n">{formatBaht(p.liters)}</td>
                          <td className="n">{formatBaht(p.pricePerLiter)}</td>
                          <td className="n">{formatBaht(p.amount)}</td>
                          <td>
                            {p.billNo ?? ""}
                            {p.pendingConfirm && !p.cancelled && <span className="ml-2 rounded bg-safety-soft px-1.5 text-[13px] no-underline">รอยืนยัน (จากมือถือ)</span>}
                            {p.hasPhoto && (
                              <a href={`/api/purchase-photo/${p.id}`} target="_blank" rel="noreferrer" className="ml-2 text-earth underline">
                                ดูรูปบิล
                              </a>
                            )}
                          </td>
                          <td className="no-underline">
                            {p.note ?? ""}
                            {p.cancelled && <span className="block text-[13px] text-repair no-underline">ยกเลิกแล้ว: {p.cancelReason ?? "-"}</span>}
                            {p.history.length > 0 && (
                              <details className="text-[13px] text-muted">
                                <summary className="cursor-pointer">ประวัติ ({p.history.length})</summary>
                                <ul>
                                  {p.history.map((h, i) => (
                                    <li key={i}>
                                      {h.action === "update" ? "แก้ไข" : h.action === "cancel" ? "ยกเลิก" : "นำกลับมา"} · {h.userName ?? "-"} · {new Date(h.at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
                                      {h.text && <span className="block">{h.text}</span>}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </td>
                          {writer && (
                            <td className="no-underline">
                              <PurchaseRowActions id={p.id} month={month} cancelled={p.cancelled} lock={p.lock} pendingConfirm={p.pendingConfirm} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>รวม {live.length} ครั้ง</td>
                        <td className="n">{formatBaht(totalLiters)}</td>
                        <td />
                        <td className="n">{formatBaht(totalAmount)}</td>
                        <td />
                        <td />
                        {writer && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-medium leading-snug">ราคาประจำวัน {monthName}</h2>
              <p className="text-muted">วันที่ไม่ได้ใส่ราคาใช้ราคาล่าสุดก่อนหน้า ใบจ่ายของวันนั้นคิดเงินจากราคานี้</p>
              {inMonth.length === 0 ? (
                <p className="py-6 text-center text-muted">ยังไม่มีราคา</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="t">
                    <thead>
                      <tr>
                        <th>ใช้ตั้งแต่วันที่</th>
                        <th>ถึงวันที่</th>
                        <th className="n">ราคา/ลิตร (บาท)</th>
                        <th>ที่มา</th>
                        <th>
                          <span className="sr-only">แก้ราคา</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inMonth.map((p) => (
                        <tr key={p.date}>
                          <td className="whitespace-nowrap">
                            {thaiShort(p.from)}
                            {p.from > today && <span className="ml-2 rounded-full bg-safety-soft px-2 py-0.5 text-[13px]">มีผลตั้งแต่วันที่ {thaiShort(p.from)}</span>}
                          </td>
                          <td className="whitespace-nowrap">{p.to ? thaiShort(p.to) : p.from > today ? "ยังไม่ถึงวัน" : "ยังใช้อยู่"}</td>
                          <td className="n font-semibold">{formatBaht(p.pricePerLiter)}</td>
                          <td>{p.source === "purchase" ? "จากการซื้อวันนั้น" : p.source === "differs" ? "ราคาประจำวัน ซื้อวันนั้นราคาต่างจากนี้" : "ตั้งเอง วันนั้นไม่มีการซื้อ"}</td>
                          <td className="n">
                            {writer && (
                              <Link href={`${here}&new=price&date=${p.date}`} className="text-earth hover:text-ink">
                                แก้ราคา
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>

        {editing ? (
          <PurchasePanel
            key={`edit-${editing.id}`}
            mode="purchase"
            month={month}
            today={today}
            initialDate=""
            initialPrice={null}
            editing={{ id: editing.id, date: editing.date, liters: editing.liters, price: editing.pricePerLiter, amount: editing.amount, billNo: editing.billNo ?? "", note: editing.note ?? "" }}
          />
        ) : mode === "purchase" || mode === "price" ? (
          <PurchasePanel key={`${mode}-${editDate}`} mode={mode} month={month} today={today} initialDate={editDate} initialPrice={editPrice ?? null} />
        ) : null}
      </div>
    </>
  );
}
