import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { loadCycleView, loadInvoice } from "@/server/cycles/cycle-service";
import { InvoiceSheet } from "../../invoice-sheet";
import { PrintButton } from "./print-button";

export const metadata = { title: "พิมพ์ใบแจ้งค่าใช้จ่าย" };

/** every project's invoice of the cycle, one after another, one per printed page */
export default async function PrintAll({ params }: { params: Promise<{ cycleId: string }> }) {
  const session = await requireUser();
  const { cycleId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(cycleId)) notFound();
  const view = await loadCycleView(session, cycleId);
  if (!view) notFound();
  const invs = (await Promise.all(view.rows.filter((r) => r.slips > 0).map((r) => loadInvoice(session, cycleId, r.projectId)))).filter((x) => x !== null);
  return (
    <div className="flex flex-col gap-6">
      <div className="no-print flex items-center gap-4">
        <PrintButton />
        <span className="text-[14px] text-muted">{invs.length} โครงการ · พิมพ์ต่อเนื่อง โครงการละหน้า</span>
      </div>
      {invs.length === 0 && <p className="text-muted">รอบนี้ยังไม่มีใบแจ้งที่จะพิมพ์</p>}
      <div className="flex flex-col gap-6 overflow-x-auto">
        {invs.map((inv) => (
          <InvoiceSheet key={inv.project.id} inv={inv} links={false} />
        ))}
      </div>
    </div>
  );
}
