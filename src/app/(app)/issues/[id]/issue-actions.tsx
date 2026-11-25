"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Toast } from "@/components/toast";
import { Button, fieldClass, linkButton } from "@/components/ui";
import { cancelIssueAction, restoreIssueAction, signIssueAction } from "../actions";

/**
 * Buttons at the top right of a slip (design 6.5): ยกเลิกใบ (red, asks first, needs a reason) · แก้ไข (yellow).
 * Also ติ๊กว่าเซ็นรับแล้ว for a slip whose paper copy is signed later, and นำกลับมา for a cancelled one.
 */
export function IssueActions({
  id,
  label,
  cancelled,
  signed,
  locked,
  liters,
  dateText,
}: {
  id: string;
  /** "เล่มที่ 0229 เลขที่ 11445" */
  label: string;
  cancelled: boolean;
  signed: boolean;
  locked: boolean;
  /** liters of the slip and its date, said in the cancel window */
  liters: string;
  dateText: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [dialog, setDialog] = useState<null | "sign" | "cancel">(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<{ text: string; n: number } | null>(null);

  function open(d: "sign" | "cancel") {
    setMsg(null);
    setDialog(d);
  }

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, text: string) {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          setDialog(null);
          setName("");
          setReason("");
          setDone((d) => ({ text, n: (d?.n ?? 0) + 1 }));
          router.refresh();
        } else setMsg(r.message ?? "ทำไม่สำเร็จ");
      } catch {
        setMsg("ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง ข้อมูลที่พิมพ์ยังอยู่");
      }
    });
  }

  const error = msg && (
    <p role="alert" className="text-sm text-repair">
      {msg}
    </p>
  );

  return (
    <>
      {done && <Toast key={done.n}>{done.text}</Toast>}
      {cancelled ? (
        <Button disabled={busy} onClick={() => run(() => restoreIssueAction(id), "นำกลับมาแล้ว")}>
          นำกลับมา
        </Button>
      ) : (
        !locked && (
          <>
            {!signed && (
              <Button disabled={busy} onClick={() => open("sign")}>
                ติ๊กว่าเซ็นรับแล้ว
              </Button>
            )}
            <Button variant="dangerOutline" disabled={busy} onClick={() => open("cancel")}>
              ยกเลิกใบ
            </Button>
            <Link href={`/issues/${id}/edit`} className={linkButton("primary")}>
              แก้ไข
            </Link>
          </>
        )
      )}
      {cancelled && msg && error}

      <ConfirmDialog open={dialog === "cancel"} title={`ยกเลิกใบจ่าย ${label} ใช่ไหม`} onClose={() => setDialog(null)}>
        <p>
          ใบนี้จะไม่ถูกนับในสมุดคงเหลือ ตารางรายเดือน และใบแจ้งค่าใช้จ่ายอีก ยอดคงเหลือในรถตั้งแต่วันที่ {dateText} จะเพิ่มขึ้น {liters} ลิตร
        </p>
        <p className="text-sm text-muted">ถ้ายกเลิกผิด กด “นำกลับมา” ที่หน้านี้ได้ ใบจะกลับมานับตามเดิม</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dlg-why" className="text-sm">
            เหตุผลที่ยกเลิก
          </label>
          <textarea
            id="dlg-why"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น คีย์ซ้ำกับใบเลขที่อื่น หรือใบกระดาษถูกยกเลิกที่หน้างาน"
            className={`${fieldClass} h-auto min-h-[88px] resize-y py-2.5`}
          />
          <span className="text-[13px] text-muted">ต้องใส่เหตุผลก่อนจึงจะกดยกเลิกใบได้ เหตุผลจะอยู่ในประวัติของใบ</span>
        </div>
        {error}
        <div className="flex flex-wrap justify-end gap-3 pt-1">
          <Button onClick={() => setDialog(null)}>ไม่ยกเลิก กลับไปที่ใบ</Button>
          <Button variant="danger" disabled={busy} onClick={() => run(() => cancelIssueAction(id, reason), "ยกเลิกใบแล้ว")}>
            ยกเลิกใบนี้
          </Button>
        </div>
      </ConfirmDialog>

      <ConfirmDialog open={dialog === "sign"} title={`บันทึกว่าใบ ${label} เซ็นรับแล้ว`} onClose={() => setDialog(null)}>
        <p>ใบที่เซ็นรับแล้วจะนับเข้าใบแจ้งค่าใช้จ่ายของรอบ</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dlg-sign" className="text-sm">
            ชื่อผู้เซ็นรับ
          </label>
          <input id="dlg-sign" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
          <span className="text-[13px] text-muted">สโตร์หรือโฟร์แมนที่เซ็นในใบกระดาษ</span>
        </div>
        {error}
        <div className="flex flex-wrap justify-end gap-3 pt-1">
          <Button onClick={() => setDialog(null)}>ไม่บันทึก</Button>
          <Button variant="primary" disabled={busy} onClick={() => run(() => signIssueAction(id, name), "บันทึกแล้ว")}>
            บันทึกว่าเซ็นรับแล้ว
          </Button>
        </div>
      </ConfirmDialog>
    </>
  );
}
