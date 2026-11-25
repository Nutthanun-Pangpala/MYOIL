"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelPurchaseAction, confirmPurchaseAction, restorePurchaseAction } from "./actions";

type Result = { ok: boolean; message?: string; warnings?: string[]; confirm?: string[] };

/** edit · cancel (asks first, needs a reason) · restore — OBS-18 */
export function PurchaseRowActions({ id, month, cancelled, lock, pendingConfirm = false }: { id: string; month: string; cancelled: boolean; lock: string | null; pendingConfirm?: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  /** B5: slips would get another amount — shown first, done only after "ยืนยัน" */
  const [ask, setAsk] = useState<{ notes: string[]; go: () => Promise<Result> } | null>(null);

  function run(fn: (confirmed: boolean) => Promise<Result>, confirmed = false) {
    setMsg(null);
    setAsk(null);
    start(async () => {
      try {
        const r = await fn(confirmed);
        if (r.ok) {
          setAsking(false);
          setReason("");
          if (r.warnings?.length) setMsg(r.warnings.join(" · "));
          router.refresh();
        } else if (r.confirm?.length) setAsk({ notes: r.confirm, go: () => fn(true) });
        else setMsg(r.message ?? "ทำไม่สำเร็จ");
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
          <button type="button" className={link} disabled={busy} onClick={() => run((c) => restorePurchaseAction(id, c))}>
            นำกลับมา
          </button>
        ) : (
          <>
            {pendingConfirm && (
              <button type="button" className={link} disabled={busy} onClick={() => run(() => confirmPurchaseAction(id))}>
                ยืนยัน
              </button>
            )}
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
            <button type="button" className={link} disabled={busy} onClick={() => run((c) => cancelPurchaseAction(id, reason, c))}>
              ยืนยันยกเลิก
            </button>
            <button type="button" className={link} onClick={() => setAsking(false)}>
              ไม่ยกเลิก
            </button>
          </div>
        </div>
      )}
      {ask && (
        <div role="alert" className="flex max-w-[320px] flex-col gap-2 rounded-control bg-safety-soft p-2 text-[13px]">
          {ask.notes.map((n) => (
            <span key={n}>{n}</span>
          ))}
          <div className="flex gap-3">
            <button type="button" className={link} disabled={busy} onClick={() => run(ask.go, true)}>
              ยืนยันทำต่อ
            </button>
            <button type="button" className={link} onClick={() => setAsk(null)}>
              ไม่ทำ
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
