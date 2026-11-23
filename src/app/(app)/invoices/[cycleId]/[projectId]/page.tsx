import Link from "next/link";
import { notFound } from "next/navigation";
import { INVOICE_LABEL } from "@/domain/cycle";
import { Pill } from "@/components/ui";
import { canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { cycleLabel, loadInvoice } from "@/server/cycles/cycle-service";
import { InvoiceSheet } from "../../invoice-sheet";
import { InvoicePanel } from "./invoice-panel";

export const metadata = { title: "ใบแจ้งค่าใช้จ่ายโครงการ" };

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
      <header className="no-print flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href={`/invoices?cycle=${cycleId}`} className="text-[14px] text-earth underline">
            กลับไปรายการรอบ {label}
          </Link>
          <h1 className="font-display text-3xl font-semibold">
            ใบแจ้งค่าใช้จ่าย {inv.project.ref} รอบ {label}
          </h1>
        </div>
        <Pill tone={inv.status === "draft" ? "wait" : "ok"}>{INVOICE_LABEL[inv.status]}</Pill>
      </header>

      {inv.unsigned.slips > 0 && (
        <p className="no-print rounded-control border border-line bg-card px-4 py-3 text-[14px]">
          ใบยังไม่เซ็นรับ {inv.unsigned.slips} ใบ ({inv.unsigned.liters} ลิตร) ไม่อยู่ในใบแจ้งนี้{closed ? "" : " ถ้าปิดรอบตอนนี้ ใบเหล่านี้จะถูกยกไปรอบถัดไป"}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_620px] overflow-x-auto">
          {inv.lines.length === 0 ? (
            <p className="rounded-card border border-line bg-card p-8 text-center text-muted">รอบนี้ยังไม่มีใบจ่ายที่เซ็นรับของโครงการนี้</p>
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
        />
      </div>
    </div>
  );
}
