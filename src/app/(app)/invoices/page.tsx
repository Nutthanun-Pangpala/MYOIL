import Link from "next/link";
import { FilterForm } from "@/components/filter-form";
import { Card, CardTitle, PageHeader, Pill, ProjectChip, StateBox, fieldClass, linkButton, linkClass, type Tone } from "@/components/ui";
import { INVOICE_FLOW, INVOICE_LABEL, type InvoiceStatus } from "@/domain/cycle";
import { monthRange } from "@/domain/iso-date";
import { sumLiters } from "@/domain/money";
import { thaiRange } from "@/domain/thai-date";
import { formatBaht, formatLiters, formatStamp } from "@/lib/format";
import { canOpen } from "@/lib/nav";
import { canAdminister, canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { cycleEventsOf, cycleLabel, listCycles, loadCycleView } from "@/server/cycles/cycle-service";
import { loadMonthly } from "@/server/monthly/monthly-service";
import { CyclePanel } from "./cycle-panel";

export const metadata = { title: "ใบแจ้งค่าใช้จ่าย" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const toneOf = (s: InvoiceStatus): Tone => (s === "draft" || s === "sent_to_pm" ? "wait" : "ok");

/** design 6.9: one claim cycle, its invoices per project, and closing it */
export default async function InvoicesPage({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  const sp = await searchParams;
  const cycles = await listCycles();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const current = cycles.find((c) => c.start <= today && today <= c.end) ?? cycles[0];
  // by default the newest cycle that is still waiting for its invoices: the last closed or open one before today
  const wanted = cycles.find((c) => c.id === one(sp.cycle));
  const chosen = wanted ?? cycles.find((c) => c.end < today && c.status === "open") ?? current;
  const view = (await loadCycleView(session, chosen.id))!;
  const events = await cycleEventsOf(chosen.id);
  const closed = chosen.status === "closed";
  const label = cycleLabel(chosen);
  const range = thaiRange(chosen.start, chosen.end);
  const writer = canWriteFuel(session);

  const invoiced = view.rows.filter((r) => r.slips > 0);
  const pastDraft = invoiced.filter((r) => r.status !== "draft").length;
  const counts = INVOICE_FLOW.map((s) => ({ s, n: invoiced.filter((r) => r.status === s).length })).filter((c) => c.n > 0);

  // the line under the table says how this page adds up against the monthly table (a cycle of one calendar month)
  const month = chosen.start.slice(0, 7);
  const whole = monthRange(month);
  const monthly = whole.start === chosen.start && whole.end === chosen.end ? (await loadMonthly(session, month, today, null)).all?.grandTotal ?? null : null;
  const why: string[] = [];
  if (view.unsigned.slips > 0) why.push("ใบที่ยังไม่เซ็นรับยังไม่นับเข้าใบแจ้ง");
  if (view.waitingCheck.slips > 0) why.push("ใบจากมือถือที่ยังไม่ได้ตรวจยังไม่นับเข้าใบแจ้ง");
  const compare = (than: string, other: number) => {
    const gap = sumLiters([other, -view.totals.liters]);
    if (gap === 0) return `ยอดรวมของหน้านี้ ${formatLiters(view.totals.liters)} ลิตร ตรงกับ${than}`;
    // less: slips not invoiced yet (or carried on at closing); more: only slips carried in from the cycle before
    const reason = gap < 0 ? "ใบแจ้งรอบนี้รวมใบที่ยกมาจากรอบก่อน" : why.length ? why.join(" และ") : "มีใบที่ถูกยกไปนับในรอบอื่น";
    return `ยอดรวมของหน้านี้ ${formatLiters(view.totals.liters)} ลิตร ${gap > 0 ? "น้อยกว่า" : "มากกว่า"}${than} (${formatLiters(other)} ลิตร) อยู่ ${formatLiters(Math.abs(gap))} ลิตร เพราะ${reason}`;
  };
  const sums = monthly !== null ? compare("ตารางรายเดือน", monthly) : view.allLiters !== view.totals.liters ? compare("ใบจ่ายทั้งหมดของรอบ", view.allLiters) : null;
  const tail = closed ? "สถานะของใบแจ้งแต่ละใบเปลี่ยนในหน้าใบแจ้งของโครงการ" : invoiced.length > 0 ? "พิมพ์ทั้งหมดพิมพ์ทุกโครงการต่อเนื่องกันในครั้งเดียว" : null;
  const note = [sums, tail].filter(Boolean).join(" ");

  const pick = (
    <FilterForm key="pick" action="/invoices" search={false} className="no-print flex min-w-0 flex-[0_0_200px] flex-col gap-1.5">
      <label htmlFor="iv-cycle" className="text-sm">
        รอบเคลม
      </label>
      {/* keyed: the page can move to another cycle by itself (after closing), the box follows */}
      <select key={chosen.id} id="iv-cycle" name="cycle" defaultValue={chosen.id} className={fieldClass}>
        {cycles.map((c) => (
          <option key={c.id} value={c.id}>
            {cycleLabel(c)}
            {c.id === current.id ? " (รอบนี้)" : ""}
          </option>
        ))}
      </select>
    </FilterForm>
  );
  const print = invoiced.length > 0 && (
    <Link key="print" href={`/invoices/${chosen.id}/print`} className={`no-print self-end ${linkButton(closed ? "primary" : "secondary")}`}>
      พิมพ์ทั้งหมด
    </Link>
  );
  const panel = (
    <CyclePanel
      key="panel"
      cycleId={chosen.id}
      label={label}
      range={range}
      closed={closed}
      canClose={writer && !closed}
      canReopen={canAdminister(session) && closed}
      preview={{
        projects: invoiced.length,
        slips: view.totals.slips,
        liters: view.totals.liters,
        amount: view.totals.amount,
        unsignedSlips: view.unsigned.slips,
        unsignedLiters: view.unsigned.liters,
        invoicesPastDraft: pastDraft,
      }}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ใบแจ้งค่าใช้จ่าย"
        sub={`รอบ ${range} ${closed && chosen.closedAt ? `ปิดรอบแล้วเมื่อ ${formatStamp(chosen.closedAt)}` : "ยังไม่ปิดรอบ"}`}
        // design order: open [รอบ] [พิมพ์] [ปิดรอบ] · closed [รอบ] [เปิดรอบอีกครั้ง] [พิมพ์]; the keys keep the panel's message when it swaps
        actions={closed ? [pick, panel, print] : [pick, print, panel]}
      />

      {!closed && (view.unsigned.slips > 0 || view.waitingCheck.slips > 0) && (
        <div className="flex flex-col gap-2.5 rounded-control border border-repair bg-card px-5 py-4">
          {view.unsigned.slips > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                <strong className="text-repair">ตรวจก่อนปิดรอบ</strong> มีใบจ่ายยังไม่เซ็นรับ {view.unsigned.slips} ใบ รวม {formatLiters(view.unsigned.liters)} ลิตร ใน {view.unsigned.projects} โครงการ ถ้าปิดรอบตอนนี้ ใบเหล่านี้จะไม่อยู่ในใบแจ้งของรอบ {label} และถูกยกไปรอบถัดไป
              </span>
              <Link href="/issues?status=unsigned" className={linkClass}>
                ดูใบที่ยังไม่เซ็นรับ
              </Link>
            </div>
          )}
          {view.waitingCheck.slips > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {view.unsigned.slips === 0 && <strong className="text-repair">ตรวจก่อนปิดรอบ </strong>}
                มีใบจากมือถือที่เซ็นรับแล้วแต่ยังไม่ได้ตรวจ {view.waitingCheck.slips} ใบ รวม {formatLiters(view.waitingCheck.liters)} ลิตร ถ้าปิดรอบตอนนี้ ใบเหล่านี้จะไม่อยู่ในใบแจ้งของรอบ {label} และถูกยกไปรอบถัดไป
              </span>
              <Link href={canOpen(session.role, "/check") ? "/check" : "/issues?status=pending_review"} className={linkClass}>
                ไปตรวจใบ
              </Link>
            </div>
          )}
        </div>
      )}

      {closed && (
        <div className="flex flex-col gap-2.5 rounded-control border border-line bg-card px-5 py-4">
          <span>
            <strong>ปิดรอบแล้ว</strong> เมื่อ {chosen.closedAt ? formatStamp(chosen.closedAt) : "-"} โดย {chosen.closedByName ?? "-"} ใบจ่ายของรอบนี้แก้ไข ยกเลิก และบันทึกเพิ่มไม่ได้ มีเพียงผู้ดูแลระบบที่เปิดรอบได้
          </span>
          {counts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {counts.map(({ s, n }) => (
                <Pill key={s} tone={toneOf(s)}>
                  {INVOICE_LABEL[s]} {n} ใบ
                </Pill>
              ))}
            </div>
          )}
        </div>
      )}

      {view.rows.length === 0 ? (
        <StateBox title="รอบนี้ยังไม่มีใบจ่าย">ใบจ่ายที่ลงวันที่ {range} จะขึ้นที่นี่เมื่อบันทึกแล้ว</StateBox>
      ) : (
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="t">
              <thead>
                <tr>
                  <th>โครงการ</th>
                  <th className="n">จำนวนใบจ่าย</th>
                  <th className="n">ลิตร</th>
                  <th className="n">ยอดเงิน (บาท)</th>
                  <th>สถานะ</th>
                  <th>
                    <span className="sr-only">เปิดดู</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.projectId}>
                    <td>
                      <ProjectChip code={r.projectRef} name={r.projectName} />
                      {r.unsignedSlips > 0 &&
                        (closed ? (
                          <div className="mt-1 text-[13px] text-muted">
                            ใบยังไม่เซ็นรับ {r.unsignedSlips} ใบ ({formatLiters(r.unsignedLiters)} ลิตร) ไม่อยู่ในใบแจ้งนี้
                          </div>
                        ) : (
                          <div className="mt-1 text-[13px] text-repair">
                            ต้องตรวจ: มีใบยังไม่เซ็นรับ {r.unsignedSlips} ใบ ({formatLiters(r.unsignedLiters)} ลิตร) ยังไม่นับในยอดนี้
                          </div>
                        ))}
                    </td>
                    <td className="n">{r.slips}</td>
                    <td className="n">{formatLiters(r.liters)}</td>
                    <td className="n">
                      {formatBaht(r.amount)}
                      {r.pendingPrice > 0 && <span className="block text-[13px] text-muted">+ รอราคา {r.pendingPrice} ใบ</span>}
                    </td>
                    <td>
                      <Pill tone={toneOf(r.status)}>{INVOICE_LABEL[r.status]}</Pill>
                    </td>
                    <td>
                      <Link href={`/invoices/${chosen.id}/${r.projectId}`} className={linkClass}>
                        เปิดใบแจ้ง
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>รวม {view.totals.projects} โครงการ</td>
                  <td className="n">{view.totals.slips}</td>
                  <td className="n">{formatLiters(view.totals.liters)}</td>
                  <td className="n">{formatBaht(view.totals.amount)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {view.rows.length > 0 && note && <p className="text-[14px] text-muted">{note}</p>}

      {events.length > 0 && (
        <Card className="p-6">
          <div className="flex flex-col gap-3">
            <CardTitle>ประวัติการปิดและเปิดรอบ</CardTitle>
            <ol aria-label="ประวัติการปิดและเปิดรอบ" className="flex flex-col gap-3">
              {events.map((e, i) => (
                <li key={i} className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-muted">
                    {formatStamp(e.at)} โดย {e.userName ?? "-"}
                  </span>
                  <span>{e.action === "close" ? "ปิดรอบ" : "เปิดรอบอีกครั้ง"}</span>
                  {e.reason && <span className="text-sm text-muted">{e.action === "reopen" ? `เหตุผล: ${e.reason}` : e.reason}</span>}
                </li>
              ))}
            </ol>
          </div>
        </Card>
      )}
    </div>
  );
}
