"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, linkButton } from "@/components/ui";
import { cancelIssueAction, restoreIssueAction, signIssueAction } from "../actions";

/** edit · tick signed · cancel (asks first, needs a reason) · restore */
export function IssueActionsPanel({
  id,
  cancelled,
  signed,
  lock,
}: {
  id: string;
  cancelled: boolean;
  signed: boolean;
  lock: string | null;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [mode, setMode] = useState<null | "sign" | "cancel">(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, done: string) {
    setMsg(null);
    setOk(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          setMode(null);
          setName("");
          setReason("");
          setOk(done);
          setTimeout(() => setOk(null), 5000); // the page already shows the result (OBS-12)
          router.refresh();
        } else setMsg(r.message ?? "ทำไม่สำเร็จ");
      } catch {
        setMsg("ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  const field = "h-11 w-full rounded-control border border-line bg-card px-3 text-[15px]";
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-3">
        {cancelled ? (
          <Button disabled={busy} onClick={() => run(() => restoreIssueAction(id), "นำกลับมาแล้ว")}>
            นำกลับมา
          </Button>
        ) : (
          <>
            <Link href={`/issues/${id}/edit`} className={linkButton("primary")}>
              แก้ไขใบนี้
            </Link>
            {!signed && (
              <Button disabled={busy} onClick={() => (setMode(mode === "sign" ? null : "sign"), setMsg(null))}>
                ติ๊กว่าเซ็นรับแล้ว
              </Button>
            )}
            <Button disabled={busy} onClick={() => (setMode(mode === "cancel" ? null : "cancel"), setMsg(null))}>
              ยกเลิกใบนี้
            </Button>
          </>
        )}
      </div>

      {lock && !cancelled && (
        <p className="text-[14px] text-muted" data-testid="lock-note">
          {lock}
        </p>
      )}

      {mode === "sign" && (
        <div className="flex flex-col gap-2 sm:max-w-md">
          <label className="text-[14px]">
            ชื่อผู้เซ็นรับ
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <Button variant="primary" disabled={busy} onClick={() => run(() => signIssueAction(id, name), "บันทึกแล้ว")}>
            บันทึกว่าเซ็นรับแล้ว
          </Button>
        </div>
      )}

      {mode === "cancel" && (
        <div className="flex flex-col gap-2 rounded-control border border-repair p-3 sm:max-w-md">
          <p className="text-[14px]">
            ใบที่ยกเลิกจะไม่ถูกนับในสมุดคงเหลือ ตารางรายเดือน และใบแจ้งหนี้ แต่ยังเก็บไว้ในรายการ กด “นำกลับมา” ได้ภายหลัง
          </p>
          <label className="text-[14px]">
            เหตุผลที่ยกเลิก
            <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </label>
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => run(() => cancelIssueAction(id, reason), "ยกเลิกใบแล้ว")}>
              ยืนยันยกเลิกใบ
            </Button>
            <Button variant="ghost" onClick={() => setMode(null)}>
              ไม่ยกเลิก
            </Button>
          </div>
        </div>
      )}

      {msg && (
        <p role="alert" className="text-[14px] text-repair">
          {msg}
        </p>
      )}
      {ok && (
        <p role="status" className="text-[14px] text-working">
          {ok}
        </p>
      )}
    </Card>
  );
}
