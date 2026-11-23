import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Pill } from "@/components/ui";
import { sumAmounts, sumLiters } from "@/domain/money";
import { thaiShort } from "@/domain/thai-date";
import { formatBaht, formatLiters } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { canWriteFuel } from "@/lib/permissions";
import { changeLock } from "@/domain/issue-actions";
import { getIssue } from "@/server/issues/issue-service";
import { stockOn } from "@/server/ledger/ledger-service";
import { canOpen } from "@/lib/nav";
import { IssueActionsPanel } from "./issue-actions-panel";
import { SignedPhotoCard } from "./signed-photo-card";
import { ReviewCard } from "./review-card";
import { getReview } from "@/server/issues/review-service";

export const metadata = { title: "รายละเอียดใบจ่าย" };

const ACTION: Record<string, string> = { create: "บันทึกใบ", update: "แก้ไข", cancel: "ยกเลิกใบ", restore: "นำกลับมา" };
const FIELD: Record<string, string> = {
  bookNo: "เล่มที่",
  docNo: "เลขที่",
  issueDate: "วันที่",
  projectId: "โครงการ",
  project: "โครงการ",
  receivedSigned: "เซ็นรับ",
  receiverName: "ผู้เซ็นรับ",
  reason: "เหตุผล",
  photo: "รูปใบเซ็น",
  lines: "รายการ",
  review: "การตรวจ",
  machine: "เครื่องจักร",
};
const show = (v: unknown) => (v === true ? "เซ็นแล้ว" : v === false ? "ยังไม่เซ็น" : v === null || v === "" ? "-" : String(v));
function describe(changes: unknown): string {
  if (!changes || typeof changes !== "object") return "";
  return Object.entries(changes as Record<string, [unknown, unknown]>)
    .filter(([k]) => k !== "projectId")
    .map(([k, v]) => `${FIELD[k] ?? k}: ${show(v?.[0])} → ${show(v?.[1])}`)
    .join(" · ");
}

export default async function IssueDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; photo?: string }>;
}) {
  const session = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getIssue(session, id);
  if (!d) notFound();
  const { saved, photo } = await searchParams;
  const { head, lines, audit } = d;
  const lock = changeLock({ cancelled: head.cancelledAt !== null, closedCycleLabel: d.closedCycleLabel });

  const review = await getReview(head.id);
  const pending = lines.some((l) => l.amount === null);
  // OBS-01: a slip is the paper truth, so it saves; the page says why the balance may be wrong
  const stock = !head.cancelledAt && canOpen(session.role, "/ledger") ? await stockOn(head.issueDate) : null;
  const total = sumLiters(lines.map((l) => l.liters));
  const money = sumAmounts(lines.map((l) => l.amount ?? 0));

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Link href="/issues" className="text-[14px] text-earth underline">
        กลับไปรายการใบจ่าย
      </Link>
      {saved && (
        <p role="status" className="rounded-control bg-working-soft px-3 py-2 text-[14px] text-working">
          บันทึกแล้ว
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-earth">
          เล่มที่ {head.bookNo} เลขที่ {head.docNo}
        </h1>
        {head.cancelledAt && <Pill tone="bad">ยกเลิก</Pill>}
        {!head.cancelledAt && !head.receivedSigned && <Pill tone="wait">ยังไม่เซ็นรับ</Pill>}
        {!head.cancelledAt && review?.status === "pending_review" && <Pill tone="wait">รอตรวจ</Pill>}
        {!head.cancelledAt && pending && <Pill tone="wait">รอราคา</Pill>}
      </div>

      {stock && stock.liters < 0 && (
        <p role="note" className="rounded-control bg-safety-soft px-3 py-2 text-[14px]">
          คำเตือน: ยอดคงเหลือสิ้นวันที่ {thaiShort(head.issueDate)} ติดลบ {formatLiters(stock.liters)} ลิตร ตรวจว่าบันทึกซื้อน้ำมันเข้าครบหรือยัง ใบนี้บันทึกไว้แล้วตามใบกระดาษ
        </p>
      )}

      {head.cancelledAt && (
        <p className="rounded-control bg-repair-soft px-3 py-2 text-[14px] text-repair">
          ยกเลิกแล้ว — เหตุผล: {head.cancelReason ?? "-"}
        </p>
      )}
      {canWriteFuel(session) && <IssueActionsPanel id={head.id} cancelled={head.cancelledAt !== null} signed={head.receivedSigned} lock={lock} />}

      {review && (
        <ReviewCard
          id={head.id}
          status={review.status}
          canEdit={canWriteFuel(session) && !head.cancelledAt}
          lock={lock}
          flags={review.flags}
          confirmedWarnings={review.confirmedWarnings}
          driverName={review.driverName}
          recordedAt={review.recordedAt}
          receivedAt={review.receivedAt}
          unsignedReason={review.unsignedReason}
          reviewedBy={review.reviewedBy}
          reviewedAt={review.reviewedAt}
          editedAfterSign={review.editedAfterSign}
          lines={review.lines.map((l) => ({ ...l, liters: formatLiters(l.liters), hourMeter: l.hourMeter === null ? "" : String(l.hourMeter) }))}
          knownMachines={review.knownMachines}
        />
      )}

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        {[
          ["วันที่", thaiShort(head.issueDate)],
          ["โครงการ", `${head.projectRef} — ${head.projectName}`],
          ["เวลาเข้า – ออก", head.timeIn || head.timeOut ? `${head.timeIn ?? "-"} – ${head.timeOut ?? "-"}` : "-"],
          ["พขร.เติมน้ำมัน", head.fuelDriver ?? "-"],
          ["พขร.ดูแลเครื่องจักร", head.machineDriver ?? "-"],
          ["ผู้เซ็นรับ", head.receivedSigned ? (head.receiverName ?? "-") : "ยังไม่เซ็น"],
          ["คีย์โดย", head.recordedByName],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-[13px] text-muted">{k}</div>
            <div>{v}</div>
          </div>
        ))}
      </Card>

      <Card className="overflow-x-auto p-2">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="px-3 py-2.5 font-medium">ลำดับ</th>
              <th className="px-3 py-2.5 font-medium">รายการ/รหัสเครื่องจักร</th>
              <th className="px-3 py-2.5 text-right font-medium">ชั่วโมงทำงาน</th>
              <th className="px-3 py-2.5 text-right font-medium">ลิตร</th>
              <th className="px-3 py-2.5 text-right font-medium">บาท/ลิตร</th>
              <th className="px-3 py-2.5 text-right font-medium">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.position} className="border-t border-line">
                <td className="px-3 py-3">{l.position}</td>
                <td className="px-3 py-3">{l.machine}</td>
                <td className="num px-3 py-3">{l.hourMeter ?? "-"}</td>
                <td className="num px-3 py-3">{formatLiters(l.liters)}</td>
                <td className="num px-3 py-3">{l.pricePerLiter === null ? "รอราคา" : formatBaht(l.pricePerLiter)}</td>
                <td className="num px-3 py-3">{l.amount === null ? "รอราคา" : formatBaht(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink font-semibold">
              <td className="px-3 py-3" colSpan={3}>
                รวม
              </td>
              <td className="num px-3 py-3">
                <span className="rounded bg-safety-soft px-1.5">{formatLiters(total)}</span>
              </td>
              <td />
              <td className="num px-3 py-3">{pending ? "รอราคา" : formatBaht(money)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <SignedPhotoCard id={head.id} photoAt={d.photoAt} canEdit={canWriteFuel(session) && head.cancelledAt === null} lock={lock} failedOnSave={photo === "failed"} />

      <Card className="p-5 text-[14px] text-muted">รูปมิเตอร์และลายเซ็นบนจอ จะแสดงที่นี่ (ขั้นที่ 2)</Card>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg text-earth">ประวัติการแก้ไข</h2>
        <ul className="flex flex-col gap-1 text-[14px]">
          {audit.map((a, i) => (
            <li key={i}>
              {ACTION[a.action] ?? a.action} · {a.userName ?? "-"} · {a.at.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
              {describe(a.changes) && <span className="block text-[13px] text-muted">{describe(a.changes)}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
