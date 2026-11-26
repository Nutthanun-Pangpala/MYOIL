"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Button, fieldClass } from "@/components/ui";
import { cancelPurchaseAction, confirmPurchaseAction, restorePurchaseAction } from "./actions";

type Result = { ok: boolean; message?: string; warnings?: string[]; confirm?: string[] };

/** edit · cancel (asks first, needs a reason) · restore — OBS-18 */
export function PurchaseRowActions({ id, month, cancelled, lock, pendingConfirm = false, label }: { id: string; month: string; cancelled: boolean; lock: string | null; pendingConfirm?: boolean; /** "25/11/69 · 5,000.00 ลิตร": said in the cancel window */ label: string }) {
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
  // OBS-38: easy to hit with a thumb (44px), not a 30px word
  const link = "inline-flex min-h-11 min-w-11 items-center text-earth underline hover:text-ink disabled:opacity-60";
  const close = () => (setAsking(false), setAsk(null), setMsg(null));
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
            <button type="button" className={link} disabled={busy} onClick={() => (setMsg(null), setAsk(null), setAsking(true))}>
              ยกเลิก
            </button>
          </>
        )}
      </div>
      {/* OBS-43: its own window, not squeezed into the table cell; the red button is the one that cancels */}
      <ConfirmDialog open={asking} title={`ยกเลิกรายการซื้อ ${label} ใช่ไหม`} onClose={close}>
        <div className="flex flex-col gap-4 whitespace-normal text-left text-base">
          <p>รายการที่ยกเลิกจะไม่นับในสมุดคงเหลือ แต่ยังเก็บไว้ในรายการ กด “นำกลับมา” ได้ภายหลัง</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`why-${id}`} className="text-sm">
              เหตุผลที่ยกเลิกรายการซื้อ
            </label>
            <textarea id={`why-${id}`} rows={3} className={`${fieldClass} h-auto min-h-[88px] w-full resize-y py-2.5 text-base`} value={reason} onChange={(e) => (setReason(e.target.value), setMsg(null))} autoFocus />
          </div>
          {ask && (
            <div role="alert" className="flex flex-col gap-1 rounded-control bg-safety-soft px-3 py-2 text-sm">
              {ask.notes.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
          )}
          {msg && (
            <p role="alert" className="text-sm text-repair">
              {msg}
            </p>
          )}
          <div className="flex flex-wrap justify-between gap-6 pt-1">
            <Button type="button" onClick={close}>
              ไม่ยกเลิก
            </Button>
            {ask ? (
              <Button type="button" variant="danger" disabled={busy} onClick={() => run(ask.go, true)}>
                ยืนยันทำต่อ
              </Button>
            ) : (
              <Button type="button" variant="danger" disabled={busy} onClick={() => run((c) => cancelPurchaseAction(id, reason, c))}>
                ยืนยันยกเลิก
              </Button>
            )}
          </div>
        </div>
      </ConfirmDialog>
      {ask && !asking && (
        <div role="alert" className="flex max-w-[320px] flex-col gap-2 whitespace-normal rounded-control bg-safety-soft p-2 text-[14px]">
          {ask.notes.map((n) => (
            <span key={n}>{n}</span>
          ))}
          <div className="flex gap-4">
            <button type="button" className={link} disabled={busy} onClick={() => run(ask.go, true)}>
              ยืนยันทำต่อ
            </button>
            <button type="button" className={link} onClick={() => setAsk(null)}>
              ไม่ทำ
            </button>
          </div>
        </div>
      )}
      {msg && !asking && (
        <span role="alert" className="text-[13px] text-repair">
          {msg}
        </span>
      )}
    </div>
  );
}
