"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { INVOICE_FLOW, INVOICE_LABEL, nextInvoiceStatus, type InvoiceStatus } from "@/domain/cycle";
import { advanceInvoiceAction, saveInvoiceCodeAction } from "../../actions";

export function InvoicePanel({
  cycleId,
  projectId,
  status,
  code,
  closed,
  writer,
  hasSlips,
}: {
  cycleId: string;
  projectId: string;
  status: InvoiceStatus;
  code: string;
  closed: boolean;
  writer: boolean;
  hasSlips: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [value, setValue] = useState(code);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const next = nextInvoiceStatus(status);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, done: string) {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        setMsg(r.ok ? { ok: true, text: done } : { ok: false, text: r.message ?? "ทำไม่สำเร็จ" });
        if (r.ok) router.refresh();
      } catch {
        setMsg({ ok: false, text: "ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง" });
      }
    });
  }

  return (
    <div className="no-print flex min-w-0 flex-[1_1_280px] flex-col gap-4">
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-display text-xl font-medium">สถานะ</h2>
        <ol className="flex flex-col gap-2.5">
          {INVOICE_FLOW.map((s, i) => {
            const at = INVOICE_FLOW.indexOf(status);
            return (
              <li key={s} className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-display text-sm ${i <= at ? "bg-earth text-white" : "border border-idle text-muted"}`}
                >
                  {i + 1}
                </span>
                <span className={i === at ? "font-semibold" : i < at ? "" : "text-muted"}>
                  {INVOICE_LABEL[s]}
                  {i === at ? " (ตอนนี้)" : ""}
                </span>
              </li>
            );
          })}
        </ol>
        {writer && next && (
          <Button disabled={busy || !closed || !hasSlips} onClick={() => run(() => advanceInvoiceAction(cycleId, projectId), `เปลี่ยนเป็น ${INVOICE_LABEL[next]} แล้ว`)} className="w-full">
            เปลี่ยนเป็น {INVOICE_LABEL[next]}
          </Button>
        )}
        <p className="text-[13px] text-muted">{closed ? "แอดมินสโตร์กลางเป็นคนเปลี่ยนสถานะ" : "แอดมินสโตร์กลางเป็นคนเปลี่ยนสถานะ เปลี่ยนได้หลังปิดรอบ"}</p>
      </Card>

      {writer && (
        <Card className="flex flex-col gap-3 p-5">
          <label htmlFor="iv-code" className="text-[14px]">
            รหัสในแถวยอดรวม
          </label>
          <input
            id="iv-code"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={status !== "draft"}
            placeholder="พิมพ์รหัสที่จะพิมพ์ในแถวยอดรวม"
            className="h-11 w-full rounded-control border border-idle bg-card px-3 disabled:opacity-60"
          />
          <span className="text-[13px] text-muted">แสดงในคอลัมน์ ปรับงบลง PSY69 ของแถวยอดรวม แก้ได้ขณะใบแจ้งยังเป็นร่าง</span>
          <Button disabled={busy || status !== "draft"} onClick={() => run(() => saveInvoiceCodeAction(cycleId, projectId, value), "บันทึกรหัสแล้ว")} className="self-start">
            บันทึกรหัส
          </Button>
        </Card>
      )}

      <Button variant="primary" onClick={() => window.print()} className="w-full">
        พิมพ์
      </Button>
      <p className="text-[14px] text-muted">พิมพ์ A4 แนวตั้ง ขาวดำ ไม่มีเมนูและปุ่มของแอพ ใช้ “บันทึกเป็น PDF” ในหน้าต่างพิมพ์เพื่อได้ไฟล์ PDF กดเลขที่ในตารางเพื่อเปิดใบจ่ายต้นทาง</p>
      {!closed && <p className="rounded-control border border-line bg-card px-3 py-2 text-[14px]">รอบนี้ยังไม่ปิด ยอดอาจเปลี่ยนได้ ควรพิมพ์หลังปิดรอบ</p>}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-[14px] ${msg.ok ? "text-working" : "text-repair"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
