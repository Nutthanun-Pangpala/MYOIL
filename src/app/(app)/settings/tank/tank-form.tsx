"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { formatLiters } from "@/lib/format";
import { saveTankAction } from "../actions";

type Initial = { capacity: number | null; low: number | null; opening: number; openingDate: string | null; openingLocked: boolean };
const field = "h-11 w-full rounded-control border border-line bg-card px-3 text-[15px] disabled:opacity-60";
const num = (s: string): number | null => {
  const t = s.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export function TankForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [cap, setCap] = useState(initial.capacity === null ? "" : String(initial.capacity));
  const [low, setLow] = useState(initial.low === null ? "" : String(initial.low));
  const [opening, setOpening] = useState(String(initial.opening));
  const [date, setDate] = useState(initial.openingDate ?? "");
  const [err, setErr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const clear = (k: string) => setErr((e) => ({ ...e, [k]: "" }));

  function save() {
    setMsg(null);
    const c = num(cap), l = num(low), o = num(opening);
    const local: Record<string, string> = {};
    if (Number.isNaN(c)) local.capacity = "ใส่เป็นตัวเลข";
    if (Number.isNaN(l)) local.low = "ใส่เป็นตัวเลข";
    if (o === null || Number.isNaN(o)) local.opening = "ใส่ยอดยกมาเป็นตัวเลข (ไม่มีให้ใส่ 0)";
    if (Object.keys(local).length) return setErr(local);
    start(async () => {
      try {
        const r = await saveTankAction({ capacity: c, low: l, opening: o, openingDate: date || null });
        if (r.ok) {
          setErr({});
          setMsg({ ok: true, text: r.message ?? "บันทึกแล้ว" });
          router.refresh();
        } else {
          setErr(((r as { errors?: Record<string, string> }).errors) ?? {});
          if (!(r as { errors?: unknown }).errors) setMsg({ ok: false, text: r.message ?? "บันทึกไม่ได้" });
        }
      } catch {
        setMsg({ ok: false, text: "บันทึกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง" });
      }
    });
  }
  const Err = ({ k }: { k: string }) => (err[k] ? <span role="alert" className="block text-[13px] text-repair">{err[k]}</span> : null);

  return (
    <div className="flex flex-col gap-4">
      {initial.capacity === null && (
        <p className="rounded-control border border-line bg-card px-3 py-2 text-[14px]">ยังไม่ได้ตั้งความจุถัง รูปรถในหน้าภาพรวมจึงยังไม่แสดงระดับน้ำมันจริง ใส่ค่าด้านล่างเมื่อทราบ</p>
      )}
      <Card className="flex flex-col gap-1 p-5 text-[14px]">
        <h2 className="font-display text-lg text-earth">ค่าที่รูปรถและสมุดคงเหลือใช้</h2>
        <p>ความจุถัง {initial.capacity === null ? "ยังไม่ทราบ" : `${formatLiters(initial.capacity)} ลิตร`}</p>
        <p>เตือนใกล้หมดเมื่อเหลือต่ำกว่า {initial.low === null ? (initial.capacity === null ? "ยังไม่ทราบ" : `${formatLiters(initial.capacity * 0.2)} ลิตร (20% ของถัง ค่าเริ่มต้น)`) : `${formatLiters(initial.low)} ลิตร`}</p>
        <p>ยอดยกมา {formatLiters(initial.opening)} ลิตร{initial.openingDate ? ` ณ ${initial.openingDate}` : ""}</p>
      </Card>

      <div role="form" aria-label="แก้ค่าของรถเติมน้ำมัน" className="max-w-xl">
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-display text-xl font-medium">แก้ค่าของรถเติมน้ำมัน</h2>
          <label className="text-[14px]">
            ความจุถัง (ลิตร)
            <input className={`${field} ${err.capacity ? "border-repair" : ""}`} inputMode="decimal" value={cap} onChange={(e) => (setCap(e.target.value), clear("capacity"))} />
            <Err k="capacity" />
          </label>
          <label className="text-[14px]">
            เตือนใกล้หมดเมื่อเหลือต่ำกว่า (ลิตร)
            <input className={`${field} ${err.low ? "border-repair" : ""}`} inputMode="decimal" value={low} onChange={(e) => (setLow(e.target.value), clear("low"))} />
            <span className="text-[13px] text-muted">ใส่เป็นลิตร เพราะคนสั่งเติมคิดเป็นลิตร ไม่ใช่เปอร์เซ็นต์ เว้นว่างเพื่อใช้ 20% ของความจุ</span>
            <Err k="low" />
          </label>
          <label className="text-[14px]">
            ยอดยกมา ณ วันเริ่มใช้ (ลิตร)
            <input className={`${field} ${err.opening ? "border-repair" : ""}`} inputMode="decimal" value={opening} disabled={initial.openingLocked} onChange={(e) => (setOpening(e.target.value), clear("opening"))} />
            <span className="text-[13px] text-muted">{initial.openingLocked ? "แก้ไม่ได้แล้ว เพราะปิดรอบแรกไปแล้ว" : "แก้ได้จนกว่าจะปิดรอบแรก"}</span>
            <Err k="opening" />
          </label>
          <label className="text-[14px]">
            วันเริ่มใช้ (วันที่ของยอดยกมา)
            <input type="date" className={field} value={date} disabled={initial.openingLocked} onChange={(e) => setDate(e.target.value)} />
          </label>
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`text-[14px] ${msg.ok ? "text-working" : "text-repair"}`}>
              {msg.text}
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="primary" disabled={busy} onClick={save}>
              บันทึก
            </Button>
            <Button
              variant="ghost"
              onClick={() => (setCap(initial.capacity === null ? "" : String(initial.capacity)), setLow(initial.low === null ? "" : String(initial.low)), setOpening(String(initial.opening)), setDate(initial.openingDate ?? ""), setErr({}), setMsg(null))}
            >
              ยกเลิก
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
