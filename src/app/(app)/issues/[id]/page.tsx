import { notFound } from "next/navigation";
import { Toast } from "@/components/toast";
import { Card, CardTitle, Notice, PageHeader, Pill, ProjectChip, type Tone } from "@/components/ui";
import { changeLock } from "@/domain/issue-actions";
import { sumAmounts, sumLiters } from "@/domain/money";
import { thaiShort } from "@/domain/thai-date";
import { formatBaht, formatLiters, formatStamp } from "@/lib/format";
import { canOpen } from "@/lib/nav";
import { canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getIssue } from "@/server/issues/issue-service";
import { getReview } from "@/server/issues/review-service";
import { stockOn } from "@/server/ledger/ledger-service";
import { IssueActions } from "./issue-actions";
import { ReviewCard } from "./review-card";
import { SignedPhotoCard } from "./signed-photo-card";

export const metadata = { title: "รายละเอียดใบจ่าย" };

const ACTION: Record<string, string> = { create: "บันทึกใบจ่าย", update: "แก้ไข", cancel: "ยกเลิกใบ", restore: "นำกลับมา" };
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
function describe(changes: unknown): string[] {
  if (!changes || typeof changes !== "object") return [];
  return Object.entries(changes as Record<string, [unknown, unknown]>)
    .filter(([k]) => k !== "projectId")
    .map(([k, v]) => `${FIELD[k] ?? k}: ${show(v?.[0])} → ${show(v?.[1])}`);
}

/** design 6.5 */
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
  const { head, lines, audit, bill } = d;
  const lock = changeLock({ cancelled: head.cancelledAt !== null, closedCycleLabel: d.closedCycleLabel });
  const writer = canWriteFuel(session);

  const review = await getReview(head.id);
  const pending = lines.some((l) => l.amount === null);
  // OBS-01: a slip is the paper truth, so it saves; the page says why the balance may be wrong
  const stock = !head.cancelledAt && canOpen(session.role, "/ledger") ? await stockOn(head.issueDate) : null;
  const total = sumLiters(lines.map((l) => l.liters));
  const money = sumAmounts(lines.map((l) => l.amount ?? 0));
  const price = lines.find((l) => l.pricePerLiter !== null)?.pricePerLiter ?? null;
  const label = `เล่มที่ ${head.bookNo} เลขที่ ${head.docNo}`;

  // one status per worry, same words as the list; nothing to follow up = ปกติ
  const pills: { tone: Tone; text: string }[] = [];
  if (head.cancelledAt) pills.push({ tone: "off", text: "ยกเลิก" });
  else {
    if (!head.receivedSigned) pills.push({ tone: "wait", text: "ยังไม่เซ็นรับ" });
    if (review?.status === "pending_review") pills.push({ tone: "wait", text: "รอตรวจ" });
    if (pending) pills.push({ tone: "wait", text: "รอราคา" });
    if (d.closedCycleLabel && head.receivedSigned && head.reviewStatus === "checked" && !pending) pills.push({ tone: "ok", text: "อยู่ในใบแจ้งแล้ว" });
    if (pills.length === 0) pills.push({ tone: "ok", text: "ปกติ" });
  }

  const info: [string, React.ReactNode][] = [
    ["วันที่", thaiShort(head.issueDate)],
    [
      "โครงการ",
      <span key="p" className="flex flex-wrap items-center gap-2">
        <ProjectChip code={head.projectRef} name={head.projectName} />
        <span className="text-sm text-muted">{head.projectName}</span>
      </span>,
    ],
    ["เวลาเข้า และ เวลาออก", head.timeIn || head.timeOut ? `${head.timeIn ?? "-"} ถึง ${head.timeOut ?? "-"}` : "-"],
    ["พขร.เติมน้ำมัน", head.fuelDriver ?? "-"],
    ["พขร.ดูแลเครื่องจักร", head.machineDriver ?? "-"],
    [
      "ผู้เซ็นรับ",
      head.receivedSigned ? (
        <span key="s">
          <span>{head.receiverName ?? "-"}</span> <span className="text-muted">ใบกระดาษมีลายเซ็นแล้ว</span>
        </span>
      ) : (
        "ยังไม่เซ็น"
      ),
    ],
    ["คีย์โดย", head.source === "mobile" ? "มือถือของ พขร. (BookCare)" : head.recordedByName],
  ];

  return (
    <>
      <PageHeader
        title={`ใบจ่าย ${label}`}
        back={{ href: "/issues", label: "กลับไปรายการใบจ่าย" }}
        actions={
          <>
            {pills.map((p) => (
              <Pill key={p.text} tone={p.tone}>
                {p.text}
              </Pill>
            ))}
            {writer && (
              <IssueActions
                id={head.id}
                label={label}
                cancelled={head.cancelledAt !== null}
                signed={head.receivedSigned}
                locked={!!lock}
                liters={formatLiters(total)}
                dateText={thaiShort(head.issueDate)}
              />
            )}
          </>
        }
      />
      {saved && <Toast>บันทึกแล้ว {label}</Toast>}

      {head.cancelledAt && <p className="rounded-control bg-gray-soft px-3.5 py-3 text-gray-ink">ยกเลิกแล้ว — เหตุผล: {head.cancelReason ?? "-"}</p>}
      {writer && lock && !head.cancelledAt && (
        <p className="text-sm text-muted" data-testid="lock-note">
          {lock}
        </p>
      )}
      {stock && stock.liters < 0 && (
        <Notice>
          คำเตือน: ยอดคงเหลือสิ้นวันที่ {thaiShort(head.issueDate)} ติดลบ {formatLiters(stock.liters)} ลิตร ตรวจว่าบันทึกซื้อน้ำมันเข้าครบหรือยัง ใบนี้บันทึกไว้แล้วตามใบกระดาษ
        </Notice>
      )}

      <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-[999_1_620px] p-6">
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-x-6 gap-y-4">
              {info.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="overflow-x-auto">
              <table className="t">
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>รายการหรือรหัสเครื่องจักร</th>
                    <th className="n">ชั่วโมงการทำงาน</th>
                    <th className="n">ลิตร</th>
                    <th className="n">ยอดเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.position}>
                      <td>{l.position}</td>
                      <td>{l.machine}</td>
                      <td className="n">{l.hourMeter ?? "–"}</td>
                      <td className="n">{formatLiters(l.liters)}</td>
                      <td className="n">{l.amount === null ? "รอราคา" : formatBaht(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>{pending ? `รวม ยังไม่มีบิลซื้อก่อนวันที่ ${thaiShort(head.issueDate)}` : `รวม ราคา ${formatBaht(price ?? 0)} บาท/ลิตร ${bill ? `ตามบิลซื้อวันที่ ${thaiShort(bill.date)}${bill.billNo ? ` เลขที่ ${bill.billNo}` : ""}` : `ของวันที่ ${thaiShort(head.issueDate)}`}`}</td>
                    <td className="n">{formatLiters(total)}</td>
                    <td className="n">{pending ? "รอราคา" : formatBaht(money)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Card>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <SignedPhotoCard id={head.id} photoAt={d.photoAt} canEdit={writer && head.cancelledAt === null} lock={lock} failedOnSave={photo === "failed"} />

          {review && (
            <ReviewCard
              id={head.id}
              status={review.status}
              canEdit={writer && !head.cancelledAt}
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

          <Card className="p-5">
            <div className="flex flex-col gap-3">
              <CardTitle>ประวัติการแก้ไข</CardTitle>
              <ol aria-label="ประวัติการแก้ไข" className="flex flex-col gap-3">
                {audit.map((a, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    <span className="text-[13px] text-muted">
                      {formatStamp(a.at)} โดย {a.userName ?? "-"}
                    </span>
                    <span>{ACTION[a.action] ?? a.action}</span>
                    {describe(a.changes).map((t) => (
                      <span key={t} className="text-sm text-muted">
                        {t}
                      </span>
                    ))}
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
