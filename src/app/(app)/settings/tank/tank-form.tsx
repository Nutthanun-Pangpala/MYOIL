"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toast } from "@/components/toast";
import { Button, Card, CardTitle, Field, fieldBadClass, fieldClass } from "@/components/ui";
import { thaiShort } from "@/domain/thai-date";
import { formatLiters } from "@/lib/format";
import { saveTankAction } from "../actions";
import { SettingsHeader } from "../settings-header";

type Initial = { capacity: number | null; low: number | null; opening: number; openingDate: string | null; openingLocked: boolean };
const num = (s: string): number | null => {
  const t = s.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const off = "disabled:bg-page disabled:text-muted";

/** design 6.11 รถเติมน้ำมัน: what the truck picture and the balance book use, and the form that changes it */
export function TankForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [cap, setCap] = useState(initial.capacity === null ? "" : String(initial.capacity));
  const [low, setLow] = useState(initial.low === null ? "" : String(initial.low));
  const [opening, setOpening] = useState(String(initial.opening));
  const [date, setDate] = useState(initial.openingDate ?? "");
  const [err, setErr] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ n: number; text: string } | null>(null);
  const clear = (k: string) => setErr((e) => ({ ...e, [k]: "" }));
  const bad = (k: string) => (err[k] ? fieldBadClass : "");

  function save() {
    setError(null);
    const c = num(cap),
      l = num(low),
      o = num(opening);
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
          setDone((d) => ({ n: (d?.n ?? 0) + 1, text: r.message ?? "บันทึกแล้ว" }));
          router.refresh();
        } else {
          setErr((r as { errors?: Record<string, string> }).errors ?? {});
          if (!(r as { errors?: unknown }).errors) setError(r.message ?? "บันทึกไม่ได้");
        }
      } catch {
        setError("บันทึกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }
  function reset() {
    setCap(initial.capacity === null ? "" : String(initial.capacity));
    setLow(initial.low === null ? "" : String(initial.low));
    setOpening(String(initial.opening));
    setDate(initial.openingDate ?? "");
    setErr({});
    setError(null);
  }

  const lowNow =
    initial.low === null ? (initial.capacity === null ? "ยังไม่ทราบ" : `${formatLiters(initial.capacity * 0.2)} ลิตร (20% ของถัง ค่าเริ่มต้น)`) : `${formatLiters(initial.low)} ลิตร`;

  return (
    <>
      <SettingsHeader />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          {initial.capacity === null && (
            <p className="rounded-control border border-repair bg-card px-[18px] py-3.5">
              <strong className="text-repair">ยังไม่มีค่าจริง</strong> ยังไม่ได้ตั้งความจุถัง รูปรถในหน้าภาพรวมจึงยังไม่แสดงระดับน้ำมันจริง ใส่ค่าในช่องแก้ค่าเมื่อทราบ
            </p>
          )}
          <Card className="flex flex-col gap-4 p-6">
            <CardTitle>ค่าที่รูปรถและสมุดคงเหลือใช้</CardTitle>
            {/* the space between term and value keeps "ความจุถัง 1,000 ลิตร" readable as one line for search and screen readers */}
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-x-6 gap-y-4">
              <div className="flex flex-col gap-0.5">
                <dt className="text-sm text-muted">ความจุถัง</dt>{" "}
                <dd>{initial.capacity === null ? "ยังไม่ทราบ" : `${formatLiters(initial.capacity)} ลิตร`}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-sm text-muted">เตือนใกล้หมดเมื่อเหลือต่ำกว่า</dt> <dd>{lowNow}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-sm text-muted">ยอดยกมา ณ วันเริ่มใช้</dt>{" "}
                <dd>
                  {formatLiters(initial.opening)} ลิตร{initial.openingDate ? ` (${thaiShort(initial.openingDate)})` : ""}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <div role="form" aria-label="แก้ค่าของรถเติมน้ำมัน" className="min-w-0 flex-[1_1_340px]">
          <Card className="flex flex-col gap-4 p-6">
            <CardTitle>แก้ค่าของรถเติมน้ำมัน</CardTitle>
            <Field label="ความจุถัง (ลิตร)" htmlFor="st-cap" error={err.capacity}>
              <input id="st-cap" className={`${fieldClass} ${bad("capacity")}`} inputMode="decimal" placeholder="เช่น 6,000" value={cap} onChange={(e) => (setCap(e.target.value), clear("capacity"))} />
            </Field>
            <Field label="เตือนใกล้หมดเมื่อเหลือต่ำกว่า (ลิตร)" htmlFor="st-low" error={err.low} hint="ใส่เป็นลิตร เพราะคนสั่งเติมคิดเป็นลิตร ไม่ใช่เปอร์เซ็นต์ เว้นว่างเพื่อใช้ 20% ของความจุ">
              <input id="st-low" className={`${fieldClass} ${bad("low")}`} inputMode="decimal" value={low} onChange={(e) => (setLow(e.target.value), clear("low"))} />
            </Field>
            <Field
              label="ยอดยกมา ณ วันเริ่มใช้ (ลิตร)"
              htmlFor="st-open"
              error={err.opening}
              hint={initial.openingLocked ? "แก้ไม่ได้แล้ว เพราะปิดรอบแรกไปแล้ว" : "แก้ได้จนกว่าจะปิดรอบแรก"}
            >
              <input
                id="st-open"
                className={`${fieldClass} ${bad("opening")} ${off}`}
                inputMode="decimal"
                value={opening}
                disabled={initial.openingLocked}
                onChange={(e) => (setOpening(e.target.value), clear("opening"))}
              />
            </Field>
            <Field label="วันเริ่มใช้ (วันที่ของยอดยกมา)" htmlFor="st-date">
              <input id="st-date" type="date" className={`${fieldClass} ${off}`} value={date} disabled={initial.openingLocked} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {error && (
              <p role="alert" className="text-[14px] text-repair">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" disabled={busy} onClick={save}>
                บันทึก
              </Button>
              <Button onClick={reset}>ยกเลิก</Button>
            </div>
            {done && <Toast key={done.n}>{done.text}</Toast>}
          </Card>
        </div>
      </div>
    </>
  );
}
