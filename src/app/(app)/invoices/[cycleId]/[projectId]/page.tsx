import { notFound } from "next/navigation";
import { INVOICE_LABEL } from "@/domain/cycle";
import { PageHeader, Pill, StateBox } from "@/components/ui";
import { formatLiters } from "@/lib/format";
import { canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { cycleLabel, loadInvoice } from "@/server/cycles/cycle-service";
import { InvoiceSheet } from "../../invoice-sheet";
import { InvoicePanel } from "./invoice-panel";

export const metadata = { title: "ใบแจ้งค่าใช้จ่ายโครงการ" };

/** design 6.10: the printed form on the left, its status, total-row code and print on the right */
export default async function InvoicePage({ params }: { params: Promise<{ cycleId: string; projectId: string }> }) {
  const session = await requireUser();
  const { cycleId, projectId } = await params;
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(cycleId) || !uuid.test(projectId)) notFound();
  const inv = await loadInvoice(session, cycleId, projectId);
  if (!inv) notFound();
  const closed = inv.cycle.status === "closed";
  const label = cycleLabel(inv.cycle);

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <PageHeader
          back={{ href: `/invoices?cycle=${cycleId}`, label: `กลับไปรายการรอบ ${label}` }}
          title={`ใบแจ้งค่าใช้จ่าย ${inv.project.ref} รอบ ${label}`}
          actions={<Pill tone={inv.status === "draft" || inv.status === "sent_to_pm" ? "wait" : "ok"}>{INVOICE_LABEL[inv.status]}</Pill>}
        />
      </div>

      {inv.unsigned.slips > 0 && (
        <p className="no-print rounded-control border border-line bg-card px-5 py-4">
          ใบยังไม่เซ็นรับ {inv.unsigned.slips} ใบ ({formatLiters(inv.unsigned.liters)} ลิตร) ไม่อยู่ในใบแจ้งนี้{closed ? "" : " ถ้าปิดรอบตอนนี้ ใบเหล่านี้จะถูกยกไปรอบถัดไป"}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_620px] overflow-x-auto">
          {inv.lines.length === 0 ? (
            <StateBox title="รอบนี้ยังไม่มีใบจ่ายที่เซ็นรับของโครงการนี้">ใบแจ้งออกจากใบจ่ายที่เซ็นรับแล้วเท่านั้น</StateBox>
          ) : (
            <InvoiceSheet inv={inv} />
          )}
        </div>
        <InvoicePanel
          cycleId={cycleId}
          projectId={projectId}
          status={inv.status}
          code={inv.totalRowCode}
          closed={closed}
          writer={canWriteFuel(session)}
          hasSlips={inv.lines.length > 0}
          fileName={`ใบแจ้งค่าใช้จ่าย ${inv.project.ref} ${label}`}
        />
      </div>
    </div>
  );
}
