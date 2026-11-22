"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelPurchaseAction, restorePurchaseAction } from "./actions";

/** edit · cancel (asks first, needs a reason) · restore — OBS-18 */
export function PurchaseRowActions({ id, month, cancelled, lock }: { id: string; month: string; cancelled: boolean; lock: string | null }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          setAsking(false);
          setReason("");
          router.refresh();
        } else setMsg(r.message ?? "ทำไม่สำเร็จ");
      } catch {
        setMsg("ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  if (lock) return <span className="text-[13px] text-muted">{lock}</span>;
  const link = "min-h-9 text-earth underline hover:text-ink disabled:opacity-60";
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-3">
        {cancelled ? (
          <button type="button" className={link} disabled={busy} onClick={() => run(() => restorePurchaseAction(id))}>
            นำกลับมา
          </button>
        ) : (
          <>
            <Link href={`/purchases?month=${month}&edit=${id}`} className={link}>
              แก้ไข
            </Link>
            <button type="button" className={link} disabled={busy} onClick={() => setAsking(!asking)}>
              ยกเลิก
            </button>
          </>
        )}
      </div>
      {asking && (
        <div className="flex flex-col gap-2 rounded-control border border-repair p-2">
          <label className="text-[13px]">
            เหตุผลที่ยกเลิกรายการซื้อ
            <input className="mt-1 h-10 w-full min-w-[200px] rounded-control border border-line bg-card px-2" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </label>
          <span className="text-[13px] text-muted">รายการที่ยกเลิกจะไม่นับในสมุดคงเหลือ แต่ยังเก็บไว้ในรายการ กด “นำกลับมา” ได้ภายหลัง</span>
          <div className="flex gap-3">
            <button type="button" className={link} disabled={busy} onClick={() => run(() => cancelPurchaseAction(id, reason))}>
              ยืนยันยกเลิก
            </button>
            <button type="button" className={link} onClick={() => setAsking(false)}>
              ไม่ยกเลิก
            </button>
          </div>
        </div>
      )}
      {msg && (
        <span role="alert" className="text-[13px] text-repair">
          {msg}
        </span>
      )}
    </div>
  );
}
