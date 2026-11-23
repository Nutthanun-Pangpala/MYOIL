"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { flagLabel } from "@/domain/bookcare-flags";
import { acceptMachineAction, markCheckedAction, mergeMachineAction } from "../review-actions";

type Line = { lineId: string; position: number; machineId: string; machine: string; machinePending: boolean; liters: string; hourMeter: string; hasPhoto: boolean };
export type ReviewCardProps = {
  id: string;
  status: "pending_review" | "checked";
  canEdit: boolean;
  lock: string | null;
  flags: string[];
  confirmedWarnings: string[];
  driverName: string | null;
  recordedAt: string | null;
  receivedAt: string | null;
  unsignedReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  editedAfterSign: boolean;
  lines: Line[];
  knownMachines: { id: string; code: string }[];
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) : "-");

/** a slip sent from the phone: meter photo next to the liters, held machine names, and the "ตรวจแล้ว" button */
export function ReviewCard(p: ReviewCardProps) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [into, setInto] = useState<Record<string, string>>({});
  const held = p.lines.filter((l) => l.machinePending);
  const flags = [...p.flags, ...p.confirmedWarnings];

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) router.refresh();
        else setMsg(r.message ?? "ทำไม่สำเร็จ");
      } catch {
        setMsg("ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg text-earth">ตรวจใบจากมือถือ</h2>
        {p.status === "pending_review" ? <Pill tone="wait">รอตรวจ</Pill> : <Pill tone="ok">ตรวจแล้ว</Pill>}
        {p.editedAfterSign && <Pill tone="wait">แก้หลังเซ็นรับ</Pill>}
      </div>
      <p className="text-[14px] text-muted">
        พขร. {p.driverName ?? "-"} · บันทึกที่หน้างาน {when(p.recordedAt)} · ถึง MYOIL {when(p.receivedAt)}
        {p.unsignedReason ? ` · ไม่มีผู้เซ็นรับ: ${p.unsignedReason}` : ""}
      </p>

      {flags.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-control bg-safety-soft px-3 py-2 text-[14px]">
          {flags.map((f) => (
            <li key={f}>⚠ {flagLabel(f)}</li>
          ))}
        </ul>
      )}

      <p className="text-[14px]">เทียบรูปมิเตอร์กับจำนวนลิตรของแต่ละบรรทัด แล้วกด “ตรวจแล้ว” ใบจากมือถือจะเข้าใบแจ้งค่าใช้จ่ายได้หลังตรวจเท่านั้น</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {p.lines.map((l) => (
          <li key={l.lineId} className="flex flex-col gap-2 rounded-control border border-line p-3">
            <div className="font-medium">
              บรรทัด {l.position}: {l.machine} {l.machinePending && <Pill tone="wait">ชื่อรอตรวจ</Pill>}
            </div>
            <div className="num text-[14px]">
              {l.liters} ลิตร{l.hourMeter ? ` · ชั่วโมง/ไมล์ ${l.hourMeter}` : ""}
            </div>
            {l.hasPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <a href={`/api/issue-line-photo/${l.lineId}`} target="_blank" rel="noreferrer">
                <img src={`/api/issue-line-photo/${l.lineId}`} alt={`รูปมิเตอร์ บรรทัด ${l.position}`} className="max-h-64 w-full rounded-control object-contain bg-page" />
              </a>
            ) : (
              <p className="text-[14px] text-muted">ไม่มีรูปมิเตอร์</p>
            )}
          </li>
        ))}
      </ul>

      {p.canEdit && held.length > 0 && (
        <div className="flex flex-col gap-3 rounded-control border border-line p-3">
          <h3 className="font-medium">ชื่อเครื่องจักรที่ พขร. พิมพ์เอง</h3>
          {held.map((l) => (
            <div key={l.machineId} className="flex flex-wrap items-end gap-3">
              <div className="min-w-40">
                <div className="text-[13px] text-muted">ชื่อที่พิมพ์</div>
                <div className="font-medium">{l.machine}</div>
              </div>
              <label className="flex flex-col gap-1 text-[13px] text-muted">
                รวมกับเครื่องเดิม
                <select value={into[l.machineId] ?? ""} onChange={(e) => setInto({ ...into, [l.machineId]: e.target.value })} className="min-h-11 rounded-control border border-line bg-card px-3 text-[14px] text-ink">
                  <option value="">เลือกเครื่องเดิม…</option>
                  {p.knownMachines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" disabled={busy || !into[l.machineId]} onClick={() => run(() => mergeMachineAction(p.id, l.machineId, into[l.machineId]))}>
                รวมกับเครื่องเดิม
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => run(() => acceptMachineAction(p.id, l.machineId))}>
                รับเป็นเครื่องใหม่
              </Button>
            </div>
          ))}
        </div>
      )}

      {p.status === "pending_review" && p.canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" disabled={busy || !!p.lock || held.length > 0} onClick={() => run(() => markCheckedAction(p.id))}>
            ตรวจแล้ว
          </Button>
          {held.length > 0 && <span className="text-[14px] text-muted">จัดการชื่อเครื่องจักรด้านบนก่อน</span>}
          {p.lock && <span className="text-[14px] text-muted">{p.lock}</span>}
        </div>
      )}
      {p.status === "checked" && <p className="text-[14px] text-muted">ตรวจโดย {p.reviewedBy ?? "-"} · {when(p.reviewedAt)}</p>}
      {msg && (
        <p role="alert" className="rounded-control bg-repair-soft px-3 py-2 text-[14px] text-repair">
          {msg}
        </p>
      )}
    </Card>
  );
}
