import Link from "next/link";
import { INVOICE_LABEL } from "@/domain/cycle";
import { sumLiters } from "@/domain/money";
import { Card, Pill, linkButton } from "@/components/ui";
import { thaiShort } from "@/domain/thai-date";
import { formatBaht, formatLiters } from "@/lib/format";
import { canAdminister, canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { cycleEventsOf, cycleLabel, listCycles, loadCycleView } from "@/server/cycles/cycle-service";
import { CyclePanel } from "./cycle-panel";

export const metadata = { title: "ใบแจ้งค่าใช้จ่าย" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

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
  const range = `${thaiShort(chosen.start)} – ${thaiShort(chosen.end)}`;
  const writer = canWriteFuel(session);

  const invoiced = view.rows.filter((r) => r.slips > 0);
  const pastDraft = invoiced.filter((r) => r.status !== "draft").length;
  const gap = sumLiters([view.allLiters, -view.totals.liters]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold">ใบแจ้งค่าใช้จ่าย</h1>
          <p className="text-[14px] text-muted">
            รอบ {range} {closed ? `ปิดรอบแล้วเมื่อ ${chosen.closedAt?.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} โดย ${chosen.closedByName ?? "-"}` : "ยังไม่ปิดรอบ"}
          </p>
        </div>
        {invoiced.length > 0 && (
          <Link href={`/invoices/${chosen.id}/print`} className={linkButton()}>
            พิมพ์ทั้งหมด
          </Link>
        )}
      </header>

      <nav aria-label="รอบเคลม" className="no-print flex flex-wrap items-center gap-2">
        <span className="text-[14px]">รอบเคลม</span>
        {cycles.slice(0, 12).map((c) => (
          <Link
            key={c.id}
            href={`/invoices?cycle=${c.id}`}
            aria-current={c.id === chosen.id ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-control border px-4 text-[14px] ${c.id === chosen.id ? "border-earth bg-earth text-white" : "border-idle bg-card"}`}
          >
            {cycleLabel(c)}
            {c.id === current.id ? " (รอบนี้)" : ""}
            {c.status === "closed" ? " · ปิดแล้ว" : ""}
          </Link>
        ))}
      </nav>

      {closed && <p className="rounded-control border border-line bg-card px-4 py-3 text-[14px]">ใบจ่ายของรอบนี้แก้ไข ยกเลิก และบันทึกเพิ่มไม่ได้ มีเพียงผู้ดูแลระบบที่เปิดรอบได้</p>}

      {!closed && view.unsigned.slips > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-[14px]">
            <strong>ตรวจก่อนปิดรอบ</strong> มีใบจ่ายยังไม่เซ็นรับ {view.unsigned.slips} ใบ รวม {formatLiters(view.unsigned.liters)} ลิตร ใน {view.unsigned.projects} โครงการ ถ้าปิดรอบตอนนี้ ใบเหล่านี้จะไม่อยู่ในใบแจ้งของรอบ {label} และถูกยกไปรอบถัดไป
          </p>
          <Link href="/issues?signed=no" className={linkButton()}>
            ดูใบที่ยังไม่เซ็นรับ
          </Link>
        </Card>
      )}

      {!closed && view.waitingCheck.slips > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-[14px]">
            <strong>ตรวจก่อนปิดรอบ</strong> มีใบจากมือถือที่เซ็นรับแล้วแต่ยังไม่ได้ตรวจ {view.waitingCheck.slips} ใบ รวม {formatLiters(view.waitingCheck.liters)} ลิตร ถ้าปิดรอบตอนนี้ ใบเหล่านี้จะไม่อยู่ในใบแจ้งของรอบ {label} และถูกยกไปรอบถัดไป
          </p>
          <Link href="/issues?review=pending" className={linkButton()}>
            ไปตรวจใบ
          </Link>
        </Card>
      )}

      <CyclePanel
        cycleId={chosen.id}
        label={label}
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

      <Card className="overflow-x-auto p-2">
        {view.rows.length === 0 ? (
          <p className="p-8 text-center text-muted">รอบนี้ยังไม่มีใบจ่าย</p>
        ) : (
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="text-left text-muted">
                {["โครงการ", "จำนวนใบจ่าย", "ลิตร", "ยอดเงิน (บาท)", "สถานะ", "เปิดดู"].map((h, i) => (
                  <th key={h} className={`whitespace-nowrap px-3 py-2.5 font-medium ${i >= 1 && i <= 3 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <tr key={r.projectId} className="border-t border-line align-top hover:bg-page">
                  <td className="px-3 py-3" title={r.projectName}>
                    <span className="font-medium">{r.projectRef}</span>
                    {r.unsignedSlips > 0 && (
                      <span className="mt-1 block text-[13px] text-muted">
                        {closed ? "ใบยังไม่เซ็นรับ" : "ต้องตรวจ: มีใบยังไม่เซ็นรับ"} {r.unsignedSlips} ใบ ({formatLiters(r.unsignedLiters)} ลิตร) {closed ? "ไม่อยู่ในใบแจ้งนี้" : "ยังไม่นับในยอดนี้"}
                      </span>
                    )}
                  </td>
                  <td className="num px-3 py-3 text-right">{r.slips}</td>
                  <td className="num px-3 py-3 text-right">{formatLiters(r.liters)}</td>
                  <td className="num px-3 py-3 text-right">
                    {formatBaht(r.amount)}
                    {r.pendingPrice > 0 && <span className="block text-[13px] text-muted">+ รอราคา {r.pendingPrice} ใบ</span>}
                  </td>
                  <td className="px-3 py-3">
                    <Pill tone={r.status === "draft" ? "wait" : "ok"}>{INVOICE_LABEL[r.status]}</Pill>
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/invoices/${chosen.id}/${r.projectId}`} className="text-earth underline">
                      เปิดใบแจ้ง
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink font-semibold">
                <td className="px-3 py-3">รวม {view.totals.projects} โครงการ</td>
                <td className="num px-3 py-3 text-right">{view.totals.slips}</td>
                <td className="num px-3 py-3 text-right">{formatLiters(view.totals.liters)}</td>
                <td className="num px-3 py-3 text-right">{formatBaht(view.totals.amount)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </Card>

      {gap > 0 && (
        <p className="text-[14px] text-muted">
          ยอดรวมของหน้านี้ {formatLiters(view.totals.liters)} ลิตร น้อยกว่าใบจ่ายทั้งหมดของรอบ ({formatLiters(view.allLiters)} ลิตร) อยู่ {formatLiters(gap)} ลิตร เพราะใบที่ยังไม่เซ็นรับยังไม่นับเข้าใบแจ้ง ตารางรายเดือนนับทุกใบที่ไม่ยกเลิก
        </p>
      )}

      {events.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-2 font-display text-lg text-earth">ประวัติการปิด/เปิดรอบ</h2>
          <ul className="flex flex-col gap-1 text-[14px]">
            {events.map((e, i) => (
              <li key={i}>
                {e.action === "close" ? "ปิดรอบ" : "เปิดรอบอีกครั้ง"} · {e.userName ?? "-"} · {e.at.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
                {e.reason && <span className="block text-[13px] text-muted">{e.action === "reopen" ? `เหตุผล: ${e.reason}` : e.reason}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
