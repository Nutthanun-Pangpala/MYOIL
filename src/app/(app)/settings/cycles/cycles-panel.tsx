"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { thaiMonthShort, thaiShort } from "@/domain/thai-date";
import { updateCycleDatesAction } from "../actions";

type Row = { id: string; start: string; end: string; status: "open" | "closed"; isCurrent: boolean; future: boolean };
const field = "h-11 w-full rounded-control border border-line bg-card px-3 text-[15px]";

export function CyclesPanel({ cycles }: { cycles: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const cur = cycles.find((c) => c.id === editing);
  const idx = cur ? cycles.indexOf(cur) : -1;
  const prev = idx >= 0 ? cycles[idx + 1] : undefined; // list is newest first
  const next = idx > 0 ? cycles[idx - 1] : undefined;
  const [s, setS] = useState("");
  const [e, setE] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function open(c: Row) {
    setEditing(c.id);
    setS(c.start);
    setE(c.end);
    setMsg(null);
  }
  function save() {
    start(async () => {
      try {
        const r = await updateCycleDatesAction(editing!, s, e);
        if (r.ok) {
          setEditing(null);
          setMsg({ ok: true, text: r.message ?? "บันทึกแล้ว" });
          router.refresh();
        } else setMsg({ ok: false, text: r.message ?? "บันทึกไม่ได้" });
      } catch {
        setMsg({ ok: false, text: "บันทึกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง" });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px]">รอบถัดไปสร้างอัตโนมัติ ระบบสร้างรอบใหม่ต่อจากรอบก่อนตามรูปแบบเดิม ไม่ต้องกดเพิ่มเอง ผู้ดูแลระบบแก้วันที่ของรอบได้จนกว่ารอบนั้นจะปิด</p>
      <p className="rounded-control border border-line bg-card px-3 py-2 text-[14px]">รอคำตอบจากคนให้โจทย์ รอบนับตามเดือนปฏิทิน หรือตัดทุกวันที่ 20 ตอนนี้ใช้เดือนปฏิทินไปก่อน (คำถามข้อ 1 ใน brief)</p>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-[14px] ${msg.ok ? "text-working" : "text-repair"}`}>
          {msg.text}
        </p>
      )}
      <Card className="overflow-x-auto p-2">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="text-left text-muted">
              {["รอบ", "วันเริ่ม", "วันสิ้นสุด", "สถานะ", ""].map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-3 py-3 font-medium">{thaiMonthShort(c.start)}</td>
                <td className="px-3 py-3">{thaiShort(c.start)}</td>
                <td className="px-3 py-3">{thaiShort(c.end)}</td>
                <td className="px-3 py-3">
                  <Pill tone={c.status === "closed" ? "ok" : "wait"}>{c.status === "closed" ? "ปิดแล้ว" : c.future ? "ยังไม่เริ่ม สร้างอัตโนมัติ" : c.isCurrent ? "รอบนี้" : "ยังไม่ปิด"}</Pill>
                </td>
                <td className="px-3 py-3">
                  {c.status === "open" && (
                    <button type="button" className="text-earth underline" onClick={() => open(c)}>
                      แก้ไข
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-[13px] text-muted">รอบที่ปิดแล้วแก้วันที่ไม่ได้ รอบต้องต่อกันโดยไม่มีวันว่างและไม่ซ้อนกัน</p>

      {cur && (
        <div role="form" aria-label="แก้วันที่ของรอบ" className="max-w-xl">
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="font-display text-xl font-medium">แก้วันที่ของรอบ {thaiMonthShort(cur.start)}</h2>
            <label className="text-[14px]">
              วันเริ่ม
              <input type="date" className={`${field} disabled:opacity-60`} value={s} disabled={!!prev} onChange={(ev) => setS(ev.target.value)} />
              {prev && <span className="text-[13px] text-muted">ต้องเป็นวันถัดจากวันสิ้นสุดของรอบ {thaiMonthShort(prev.start)}</span>}
            </label>
            <label className="text-[14px]">
              วันสิ้นสุด
              <input type="date" className={field} value={e} onChange={(ev) => setE(ev.target.value)} />
              {next && <span className="text-[13px] text-muted">รอบ {thaiMonthShort(next.start)} จะเลื่อนวันเริ่มตามให้เอง</span>}
            </label>
            <div className="flex gap-3">
              <Button variant="primary" disabled={busy} onClick={save}>
                บันทึกวันที่
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                ยกเลิก
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
