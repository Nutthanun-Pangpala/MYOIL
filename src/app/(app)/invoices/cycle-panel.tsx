"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Toast } from "@/components/toast";
import { Button, fieldClass } from "@/components/ui";
import { formatBaht, formatLiters } from "@/lib/format";
import { closeCycleAction, reopenCycleAction } from "./actions";

type Preview = { projects: number; slips: number; liters: number; amount: number; unsignedSlips: number; unsignedLiters: number; invoicesPastDraft: number };
type Done = { n: number; text: string };

/**
 * Design 6.9: the header button (writers close, the system admin reopens with a reason), the window that asks first
 * and says what will happen, and the short message after. Sits in the page header; keep it under one React key there
 * so the message survives the page reloading into the other state.
 */
export function CyclePanel({
  cycleId,
  label,
  range,
  closed,
  canClose,
  canReopen,
  preview,
}: {
  cycleId: string;
  label: string;
  /** days of the cycle in words, e.g. 1–31 ต.ค. 2569 */
  range: string;
  closed: boolean;
  canClose: boolean;
  canReopen: boolean;
  preview: Preview;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string; carried?: { slips: number; liters: number } }>, said: (r: { carried?: { slips: number; liters: number } }) => string) {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          setOpen(false);
          setReason("");
          setDone((d) => ({ n: (d?.n ?? 0) + 1, text: said(r) }));
          router.refresh();
        } else setError(r.message ?? "ทำไม่สำเร็จ");
      } catch {
        setError("ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  const show = closed ? canReopen : canClose;
  const alert = error && (
    <p role="alert" className="text-sm text-repair">
      {error}
    </p>
  );
  return (
    <>
      {show && (
        <Button
          variant={closed ? "secondary" : "primary"}
          className="no-print self-end"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          {closed ? "เปิดรอบอีกครั้ง" : `ปิดรอบ ${label}`}
        </Button>
      )}

      {/* the section keeps its name for screen readers and tests */}
      <ConfirmDialog open={open && !closed} title={`ปิดรอบ ${label} ใช่ไหม`} onClose={() => setOpen(false)}>
        <section aria-label={`ปิดรอบ ${label}`} className="flex flex-col gap-4">
          <p>
            ใบแจ้งค่าใช้จ่ายของ {preview.projects} โครงการจะออกตามยอดนี้: {preview.slips} ใบจ่าย {formatLiters(preview.liters)} ลิตร {formatBaht(preview.amount)} บาท
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>ใบจ่ายในรอบนี้จะแก้ไขและยกเลิกไม่ได้</li>
            <li>รอบนี้ตัดยอดตามวันที่ในใบจ่าย คือ {range} ใบที่ลงวันที่หลังจากนี้อยู่รอบถัดไป แม้จะกดปิดรอบช้ากว่าวันตัดรอบ</li>
            <li>ใบจ่ายที่ลงวันที่ {range} จะบันทึกเพิ่มไม่ได้</li>
            {preview.unsignedSlips > 0 && (
              <li className="font-semibold text-repair">
                ใบที่ยังไม่เซ็นรับ {preview.unsignedSlips} ใบ รวม {formatLiters(preview.unsignedLiters)} ลิตร จะไม่อยู่ในใบแจ้งของรอบนี้ ระบบยกไปรอบถัดไป (วันที่และราคาเดิม) เพื่อออกใบแจ้งเมื่อเซ็นรับแล้ว
              </li>
            )}
          </ul>
          <p className="text-sm text-muted">ปิดแล้วมีเพียงผู้ดูแลระบบที่เปิดรอบได้</p>
          {alert}
          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <Button onClick={() => setOpen(false)}>ยังไม่ปิด กลับไปตรวจ</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                run(
                  () => closeCycleAction(cycleId),
                  (r) => `ปิดรอบแล้ว${r.carried?.slips ? ` ยกใบที่ยังไม่เซ็นรับ ${r.carried.slips} ใบ (${formatLiters(r.carried.liters)} ลิตร) ไปรอบถัดไป` : ""}`,
                )
              }
            >
              ปิดรอบ {label}
            </Button>
          </div>
        </section>
      </ConfirmDialog>

      <ConfirmDialog open={open && closed} title={`เปิดรอบ ${label} อีกครั้ง ใช่ไหม`} onClose={() => setOpen(false)}>
        <section aria-label={`เปิดรอบ ${label}`} className="flex flex-col gap-4">
          <p className="font-semibold text-repair">
            ใบแจ้งค่าใช้จ่ายทั้ง {preview.projects} ใบของรอบนี้จะกลับเป็นร่าง
            {preview.invoicesPastDraft > 0 ? ` รวม ${preview.invoicesPastDraft} ใบที่ส่งให้ PM เซ็น หรือส่งบัญชีไปแล้ว ซึ่งต้องออกและเซ็นใหม่` : ""}
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>ใบจ่ายของรอบนี้จะกลับมาแก้ไข ยกเลิก และบันทึกเพิ่มได้</li>
            <li>ต้องปิดรอบใหม่อีกครั้งก่อนพิมพ์ใบแจ้ง</li>
          </ul>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dlg-reopen-why" className="text-sm">
              เหตุผลที่เปิดรอบ
            </label>
            <textarea
              id="dlg-reopen-why"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น พบใบจ่ายที่คีย์ลิตรผิดหลังปิดรอบ"
              className={`${fieldClass} h-auto min-h-[88px] resize-y py-2.5`}
            />
            <span className="text-[13px] text-muted">ต้องใส่เหตุผลก่อนจึงจะเปิดรอบได้ ระบบเก็บประวัติว่าใครเปิด เมื่อไหร่ และเพราะอะไร</span>
          </div>
          {alert}
          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <Button onClick={() => setOpen(false)}>ไม่เปิด ปิดรอบไว้ตามเดิม</Button>
            <Button variant="danger" disabled={busy} onClick={() => run(() => reopenCycleAction(cycleId, reason), () => "เปิดรอบอีกครั้งแล้ว")}>
              เปิดรอบอีกครั้ง
            </Button>
          </div>
        </section>
      </ConfirmDialog>

      {done && <Toast key={done.n}>{done.text}</Toast>}
    </>
  );
}
