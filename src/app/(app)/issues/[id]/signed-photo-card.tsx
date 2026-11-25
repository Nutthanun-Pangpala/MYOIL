"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button, Card, CardTitle, linkButton } from "@/components/ui";
import { shrinkImage } from "@/lib/image-shrink";
import { attachSignedPhotoAction, removeSignedPhotoAction } from "../actions";

/** the photo of the signed paper slip: look at it, attach, replace or remove (writers only, not when the slip is locked) */
export function SignedPhotoCard({
  id,
  photoAt,
  canEdit,
  lock,
  failedOnSave,
}: {
  id: string;
  photoAt: number | null;
  canEdit: boolean;
  lock: string | null;
  failedOnSave: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(failedOnSave ? "บันทึกใบแล้ว แต่แนบรูปไม่สำเร็จ เลือกรูปอีกครั้งด้านล่าง" : null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const src = `/api/issue-photo/${id}?v=${photoAt ?? 0}`;

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, done: string) {
    setMsg(null);
    setOk(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          setConfirming(false);
          setOk(done);
          setTimeout(() => setOk(null), 5000);
          router.refresh();
        } else setMsg(r.message ?? "ทำไม่สำเร็จ");
      } catch {
        setMsg("ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  async function onPick(f: File | undefined) {
    if (!f) return;
    setMsg(null);
    const small = await shrinkImage(f);
    if (!small) return setMsg("เปิดรูปนี้ไม่ได้ เลือกไฟล์ JPG หรือ PNG");
    run(() => attachSignedPhotoAction(id, small), photoAt ? "เปลี่ยนรูปแล้ว" : "แนบรูปแล้ว");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <CardTitle>รูปแนบ</CardTitle>
      {photoAt ? (
        <a href={src} target="_blank" rel="noreferrer" className="block" aria-label="เปิดรูปใบเซ็นเต็มจอ" title="กดเพื่อขยาย">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="รูปใบจ่ายที่เซ็นแล้ว" className="max-h-80 w-full rounded-control border border-line bg-page object-contain" />
        </a>
      ) : (
        <p className="flex h-[140px] items-center justify-center rounded-control border border-line bg-page px-4 text-center text-sm text-muted">ยังไม่มีรูปใบเซ็น</p>
      )}
      {canEdit && !lock && (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} id="signed-photo" type="file" accept="image/*" className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
          <label htmlFor="signed-photo" aria-disabled={busy} className={`${linkButton("secondary")} cursor-pointer aria-disabled:opacity-50`}>
            {photoAt ? "เปลี่ยนรูปใบเซ็น" : "แนบรูปใบเซ็น"}
          </label>
          {photoAt && !confirming && (
            <Button type="button" disabled={busy} onClick={() => setConfirming(true)}>
              ลบรูป
            </Button>
          )}
          {photoAt && confirming && (
            <span className="flex flex-wrap items-center gap-2 text-[14px]">
              ลบรูปนี้ใช่ไหม
              <Button type="button" disabled={busy} onClick={() => run(() => removeSignedPhotoAction(id), "ลบรูปแล้ว")}>
                ลบ
              </Button>
              <Button type="button" disabled={busy} onClick={() => setConfirming(false)}>
                ไม่ลบ
              </Button>
            </span>
          )}
        </div>
      )}
      {canEdit && lock && <p className="text-sm text-muted">{lock}</p>}
      {busy && <p className="text-[14px] text-muted">กำลังบันทึกรูป…</p>}
      {msg && (
        <p role="alert" className="text-[14px] text-repair">
          {msg}
        </p>
      )}
      {ok && (
        <p role="status" className="rounded-control bg-working-soft px-3 py-2 text-sm text-working-ink">
          {ok}
        </p>
      )}
    </Card>
  );
}
