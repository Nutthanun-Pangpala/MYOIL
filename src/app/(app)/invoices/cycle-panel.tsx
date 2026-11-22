"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { formatBaht, formatLiters } from "@/lib/format";
import { closeCycleAction, reopenCycleAction } from "./actions";

type Preview = { projects: number; slips: number; liters: number; amount: number; unsignedSlips: number; unsignedLiters: number; invoicesPastDraft: number };

/** close (writers) and reopen (system admin, with a reason). Both ask first and say what will happen. */
export function CyclePanel({ cycleId, label, closed, canClose, canReopen, preview }: { cycleId: string; label: string; closed: boolean; canClose: boolean; canReopen: boolean; preview: Preview }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string; carried?: { slips: number; liters: number } }>, done: (r: { carried?: { slips: number; liters: number } }) => string) {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          setOpen(false);
          setReason("");
          setMsg({ ok: true, text: done(r) });
          router.refresh();
        } else setMsg({ ok: false, text: r.message ?? "ทำไม่สำเร็จ" });
      } catch {
        setMsg({ ok: false, text: "ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง" });
      }
    });
  }

  const show = closed ? canReopen : canClose;
  return (
    <div className="no-print flex flex-col gap-3">
      {show && !open && (
        <div>
          <Button variant={closed ? "secondary" : "primary"} onClick={() => setOpen(true)}>
            {closed ? "เปิดรอบอีกครั้ง" : `ปิดรอบ ${label}`}
          </Button>
        </div>
      )}

      {open && !closed && (
        <section aria-label={`ปิดรอบ ${label}`} className="flex max-w-2xl flex-col gap-3 rounded-card border border-idle bg-card p-5">
          <h2 className="font-display text-xl font-medium">ปิดรอบ {label} ใช่ไหม</h2>
          <p className="text-[14px]">
            ใบแจ้งค่าใช้จ่ายของ {preview.projects} โครงการจะออกตามยอดนี้: {preview.slips} ใบจ่าย {formatLiters(preview.liters)} ลิตร {formatBaht(preview.amount)} บาท
          </p>
          <ul className="list-disc pl-5 text-[14px]">
            <li>ใบจ่ายในรอบนี้จะแก้ไขและยกเลิกไม่ได้</li>
            <li>ใบจ่ายที่ลงวันที่ในรอบนี้จะบันทึกเพิ่มไม่ได้</li>
            {preview.unsignedSlips > 0 && (
              <li>
                ใบที่ยังไม่เซ็นรับ {preview.unsignedSlips} ใบ รวม {formatLiters(preview.unsignedLiters)} ลิตร จะไม่อยู่ในใบแจ้งของรอบนี้ ระบบยกไปรอบถัดไป (วันที่และราคาเดิม) เพื่อออกใบแจ้งเมื่อเซ็นรับแล้ว
              </li>
            )}
            <li>ปิดแล้วมีเพียงผู้ดูแลระบบที่เปิดรอบได้</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              ยังไม่ปิด กลับไปตรวจ
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => run(() => closeCycleAction(cycleId), (r) => `ปิดรอบแล้ว${r.carried?.slips ? ` ยกใบที่ยังไม่เซ็นรับ ${r.carried.slips} ใบ (${formatLiters(r.carried.liters)} ลิตร) ไปรอบถัดไป` : ""}`)}>
              ปิดรอบ {label}
            </Button>
          </div>
        </section>
      )}

      {open && closed && (
        <section aria-label={`เปิดรอบ ${label}`} className="flex max-w-2xl flex-col gap-3 rounded-card border border-repair bg-card p-5">
          <h2 className="font-display text-xl font-medium">เปิดรอบ {label} อีกครั้ง ใช่ไหม</h2>
          <ul className="list-disc pl-5 text-[14px]">
            <li>
              ใบแจ้งค่าใช้จ่ายทั้ง {preview.projects} ใบของรอบนี้จะกลับเป็นร่าง
              {preview.invoicesPastDraft > 0 ? ` รวม ${preview.invoicesPastDraft} ใบที่ส่งให้ PM เซ็น หรือส่งบัญชีไปแล้ว ซึ่งต้องออกและเซ็นใหม่` : ""}
            </li>
            <li>ใบจ่ายของรอบนี้จะกลับมาแก้ไข ยกเลิก และบันทึกเพิ่มได้</li>
            <li>ต้องปิดรอบใหม่อีกครั้งก่อนพิมพ์ใบแจ้ง</li>
          </ul>
          <label className="flex flex-col gap-1 text-[14px]">
            เหตุผลที่เปิดรอบ
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 rounded-control border border-idle bg-card px-3" autoFocus />
            <span className="text-[13px] text-muted">ต้องใส่เหตุผลก่อนจึงจะเปิดรอบได้ ระบบเก็บประวัติว่าใครเปิด เมื่อไหร่ และเพราะอะไร</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              ไม่เปิด ปิดรอบไว้ตามเดิม
            </Button>
            <Button disabled={busy} onClick={() => run(() => reopenCycleAction(cycleId, reason), () => "เปิดรอบอีกครั้งแล้ว")}>
              เปิดรอบอีกครั้ง
            </Button>
          </div>
        </section>
      )}

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-[14px] ${msg.ok ? "text-working" : "text-repair"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
