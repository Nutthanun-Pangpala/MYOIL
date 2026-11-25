"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toast } from "@/components/toast";
import { Button, Card, CardTitle, fieldClass } from "@/components/ui";
import { INVOICE_FLOW, INVOICE_LABEL, nextInvoiceStatus, type InvoiceStatus } from "@/domain/cycle";
import { advanceInvoiceAction, saveInvoiceCodeAction } from "../../actions";

/** print with a file name: "บันทึกเป็น PDF" in the print window then suggests it (browsers take the page title) */
function printAs(name: string) {
  const was = document.title;
  document.title = name;
  const back = () => {
    document.title = was;
    window.removeEventListener("afterprint", back);
  };
  window.addEventListener("afterprint", back);
  window.print();
}

/** design 6.10, right column */
export function InvoicePanel({
  cycleId,
  projectId,
  status,
  code,
  closed,
  writer,
  hasSlips,
  fileName,
}: {
  cycleId: string;
  projectId: string;
  status: InvoiceStatus;
  code: string;
  closed: boolean;
  writer: boolean;
  hasSlips: boolean;
  /** name of the PDF file */
  fileName: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [value, setValue] = useState(code);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ n: number; text: string } | null>(null);
  const next = nextInvoiceStatus(status);
  const at = INVOICE_FLOW.indexOf(status);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, said: string) {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          setDone((d) => ({ n: (d?.n ?? 0) + 1, text: said }));
          router.refresh();
        } else setError(r.message ?? "ทำไม่สำเร็จ");
      } catch {
        setError("ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  return (
    <div className="no-print flex min-w-0 flex-[1_1_280px] flex-col gap-4">
      <Card className="flex flex-col gap-3.5 p-5">
        <CardTitle>สถานะ</CardTitle>
        <ol className="flex flex-col gap-2.5">
          {INVOICE_FLOW.map((s, i) => (
            <li key={s} className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={`inline-flex size-7 items-center justify-center rounded-full font-display text-sm ${i <= at ? "bg-earth text-white" : "border border-idle text-muted"}`}
              >
                {i + 1}
              </span>
              <span className={i === at ? "font-semibold" : i < at ? "" : "text-muted"}>
                {INVOICE_LABEL[s]}
                {i === at ? " (ตอนนี้)" : ""}
              </span>
            </li>
          ))}
        </ol>
        {writer && next && (
          <Button disabled={busy || !closed || !hasSlips} onClick={() => run(() => advanceInvoiceAction(cycleId, projectId), `เปลี่ยนสถานะเป็น ${INVOICE_LABEL[next]}`)} className="w-full">
            เปลี่ยนเป็น {INVOICE_LABEL[next]}
          </Button>
        )}
        <p className="text-[13px] text-muted">{closed ? "แอดมินสโตร์กลางเป็นคนเปลี่ยนสถานะ" : "แอดมินสโตร์กลางเป็นคนเปลี่ยนสถานะ เปลี่ยนได้หลังปิดรอบ"}</p>
      </Card>

      {writer && (
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="iv-code" className="text-[14px]">
              รหัสในแถวยอดรวม
            </label>
            <input
              id="iv-code"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={status !== "draft"}
              placeholder="พิมพ์รหัสที่จะพิมพ์ในแถวยอดรวม"
              className={`${fieldClass} disabled:bg-page disabled:text-muted`}
            />
            <span className="mt-1.5 text-[13px] text-muted">แสดงในคอลัมน์ ปรับงบลง PSY69 ของแถวยอดรวม แก้ได้ขณะใบแจ้งยังเป็นร่าง</span>
          </div>
          <Button disabled={busy || status !== "draft"} onClick={() => run(() => saveInvoiceCodeAction(cycleId, projectId, value), "บันทึกรหัสแล้ว")} className="self-start">
            บันทึกรหัส
          </Button>
        </Card>
      )}

      {error && (
        <p role="alert" className="text-[14px] text-repair">
          {error}
        </p>
      )}

      <Button variant="primary" onClick={() => window.print()} className="w-full">
        พิมพ์
      </Button>
      <Button onClick={() => printAs(fileName)} className="w-full">
        ดาวน์โหลด PDF
      </Button>
      <p className="text-[14px] text-muted">
        พิมพ์ A4 แนวตั้ง ขาวดำ ไม่มีเมนูและปุ่มของแอพ กดเลขที่ในตารางเพื่อเปิดใบจ่ายต้นทาง ปุ่มดาวน์โหลด PDF เปิดหน้าต่างพิมพ์ให้เลือก “บันทึกเป็น PDF” โดยตั้งชื่อไฟล์ให้แล้ว
      </p>
      {!closed && <p className="rounded-control border border-line bg-card px-3 py-2 text-[14px]">รอบนี้ยังไม่ปิด ยอดอาจเปลี่ยนได้ ควรพิมพ์หลังปิดรอบ</p>}
      {done && <Toast key={done.n}>{done.text}</Toast>}
    </div>
  );
}
