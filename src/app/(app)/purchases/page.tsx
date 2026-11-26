import Link from "next/link";
import { MonthSelect } from "@/components/month-select";
import { Card, StateBox, linkButton } from "@/components/ui";
import { isMonth } from "@/domain/iso-date";
import { sumAmounts, sumLiters } from "@/domain/money";
import { thaiMonthShort, thaiShort } from "@/domain/thai-date";
import { formatBaht, formatStamp } from "@/lib/format";
import { canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { loadPurchasePage } from "@/server/purchases/purchase-service";
import { PurchasePanel } from "./purchase-panel";
import { PurchaseRowActions } from "./row-actions";

export const metadata = { title: "ซื้อน้ำมันเข้า" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
/** OBS-38: "จัดการ" stays at the right edge while the table scrolls sideways, with a soft shadow that says there is more */
const STICKY = "sticky right-0 bg-card shadow-[-10px_0_10px_-10px_rgb(33_26_21/0.25)]";

export default async function PurchasesPage({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const month = isMonth(one(sp.month)) ? one(sp.month) : today.slice(0, 7);
  const writer = canWriteFuel(session);

  const { purchases, months } = await loadPurchasePage(month, today);
  const monthName = thaiMonthShort(`${month}-01`);
  const shown = [...purchases].reverse(); // newest first, like the design
  const live = purchases.filter((p) => !p.cancelled); // a cancelled purchase counts nowhere
  const totalLiters = sumLiters(live.map((p) => p.liters));
  const totalAmount = sumAmounts(live.map((p) => p.amount));

  const mode = writer ? one(sp.new) : "";
  const editing = writer ? purchases.find((p) => p.id === one(sp.edit) && !p.cancelled && !p.lock) : undefined;
  const editDate = one(sp.date);
  const here = `/purchases?month=${month}`;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-semibold leading-snug">ซื้อน้ำมันเข้า</h1>
          <p className="text-muted">น้ำมันที่เติมเข้ารถเติมน้ำมัน ใบจ่ายคิดเงินตามราคาของบิลซื้อ น้ำมันที่เข้าก่อนถูกใช้ก่อน</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelect id="pu-month" path="/purchases" month={month} months={months} />
          {writer && (
            <>
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
                <StateBox title="ยังไม่มีการซื้อในเดือนนี้">{writer ? "กดบันทึกการซื้อเมื่อรถเติมน้ำมันเติมเข้า" : "การซื้อที่สโตร์กลางบันทึกจะขึ้นที่นี่"}</StateBox>
              ) : (
                <div className="overflow-x-auto">
                  <p className="pb-1 text-[13px] text-muted md:hidden">เลื่อนตารางไปทางซ้ายเพื่อดูจำนวนเงิน เลขที่บิล และหมายเหตุ</p>
                  <table className="t">
                    <thead>
                      <tr>
                        <th>วันที่</th>
                        <th className="n">เติมเข้า (ลิตร)</th>
                        <th className="n">ราคา/ลิตร (บาท)</th>
                        <th className="n">จำนวนเงิน (บาท)</th>
                        <th>เลขที่บิล</th>
                        <th>หมายเหตุ</th>
                        {writer && <th className={STICKY}>จัดการ</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((p) => (
                        <tr key={p.id} className={p.cancelled ? "text-muted line-through" : undefined}>
                          <td className="whitespace-nowrap">
                            {thaiShort(p.date)}
                            <span className="ml-1.5 text-muted no-underline">{p.time ? `${p.time} น.` : "ไม่มีเวลา"}</span>
                          </td>
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
                                      {h.action === "update" ? "แก้ไข" : h.action === "cancel" ? "ยกเลิก" : "นำกลับมา"} · {h.userName ?? "-"} · {formatStamp(new Date(h.at))}
                                      {h.text && <span className="block">{h.text}</span>}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </td>
                          {writer && (
                            <td className={`no-underline ${STICKY}`}>
                              <PurchaseRowActions id={p.id} month={month} cancelled={p.cancelled} lock={p.lock} pendingConfirm={p.pendingConfirm} label={`${thaiShort(p.date)} · ${formatBaht(p.liters)} ลิตร`} />
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
                        {writer && <td className={STICKY} />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </Card>

          {/* OBS-44: the price rule in three short lines, not a grey paragraph */}
          <ul aria-label="วิธีคิดราคาใบจ่าย" className="flex list-decimal flex-col gap-1 pl-5 text-[15px]">
            <li>น้ำมันของบิลที่เข้าก่อนถูกใช้ก่อน เรียงตามวันที่และเวลาบนบิล</li>
            <li>ใบจ่ายที่คร่อมสองบิลแยกเป็นสองราคา เลือกบิลเองไม่ได้</li>
            <li>เพิ่ม แก้ หรือยกเลิกบิล ระบบบอกก่อนว่ามีกี่ใบที่ยอดเงินเปลี่ยน รอบที่ปิดแล้วไม่เปลี่ยน</li>
          </ul>
        </div>

        {editing ? (
          <PurchasePanel
            key={`edit-${editing.id}`}
            mode="purchase"
            month={month}
            today={today}
            initialDate=""
            initialPrice={null}
            editing={{ id: editing.id, date: editing.date, time: editing.time, liters: editing.liters, price: editing.pricePerLiter, amount: editing.amount, billNo: editing.billNo ?? "", note: editing.note ?? "" }}
          />
        ) : mode === "purchase" ? (
          <PurchasePanel key={`${mode}-${editDate}`} mode="purchase" month={month} today={today} initialDate={editDate} initialPrice={null} />
        ) : null}
      </div>
    </>
  );
}
