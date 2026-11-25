"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toast } from "@/components/toast";
import { Button, Card, CardTitle, Field, Pill, fieldClass } from "@/components/ui";
import { thaiMonthShort, thaiShort } from "@/domain/thai-date";
import { saveCutDayAction, updateCycleDatesAction } from "../actions";
import { SettingsHeader } from "../settings-header";

type Row = { id: string; start: string; end: string; status: "open" | "closed"; isCurrent: boolean; future: boolean };
const rowLink = "min-h-11 whitespace-nowrap px-1 text-earth underline hover:text-ink";

/** design 6.11 รอบเคลม: the cycles on the left, the date form beside them while one is being changed */
export function CyclesPanel({ cycles, cutDay }: { cycles: Row[]; cutDay: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const cur = cycles.find((c) => c.id === editing);
  const idx = cur ? cycles.indexOf(cur) : -1;
  const prev = idx >= 0 ? cycles[idx + 1] : undefined; // list is newest first
  const next = idx > 0 ? cycles[idx - 1] : undefined;
  const [s, setS] = useState("");
  const [e, setE] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ n: number; text: string } | null>(null);
  const [cut, setCut] = useState(cutDay === null ? "" : String(cutDay));
  const [cutError, setCutError] = useState<string | null>(null);
  const cutChanged = cut !== (cutDay === null ? "" : String(cutDay));
  function saveCut() {
    setCutError(null);
    start(async () => {
      try {
        const r = await saveCutDayAction(cut === "" ? null : Number(cut));
        if (r.ok) {
          setEditing(null);
          setDone((d) => ({ n: (d?.n ?? 0) + 1, text: r.message ?? "บันทึกแล้ว" }));
          router.refresh();
        } else setCutError(r.message ?? "บันทึกไม่ได้");
      } catch {
        setCutError("บันทึกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  function open(c: Row) {
    setEditing(c.id);
    setS(c.start);
    setE(c.end);
    setError(null);
  }
  function save() {
    setError(null);
    start(async () => {
      try {
        const r = await updateCycleDatesAction(editing!, s, e);
        if (r.ok) {
          setEditing(null);
          setDone((d) => ({ n: (d?.n ?? 0) + 1, text: r.message ?? "บันทึกแล้ว" }));
          router.refresh();
        } else setError(r.message ?? "บันทึกไม่ได้");
      } catch {
        setError("บันทึกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  return (
    <>
      <SettingsHeader />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Card className="flex flex-col gap-3 p-6">
            <CardTitle>วันตัดรอบของทุกเดือน</CardTitle>
            <div role="form" aria-label="วันตัดรอบของทุกเดือน" className="flex flex-wrap items-end gap-3">
              <Field label="ตัดรอบทุกวันที่" htmlFor="sc-cut" className="w-[220px]">
                <select id="sc-cut" className={fieldClass} value={cut} onChange={(ev) => (setCut(ev.target.value), setCutError(null))}>
                  <option value="">สิ้นเดือน (เดือนปฏิทิน)</option>
                  {Array.from({ length: 28 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      วันที่ {i + 1}
                    </option>
                  ))}
                </select>
              </Field>
              <Button variant="primary" disabled={busy || !cutChanged} onClick={saveCut}>
                บันทึกวันตัดรอบ
              </Button>
            </div>
            {cutError && (
              <p role="alert" className="text-[14px] text-repair">
                {cutError}
              </p>
            )}
            <p className="text-[14px] text-muted">
              {cut === ""
                ? "รอบหนึ่งคือวันที่ 1 ถึงสิ้นเดือน"
                : `รอบหนึ่งคือวันที่ ${Number(cut) + 1} ถึงวันที่ ${cut} ของเดือนถัดไป`}{" "}
              ใบจ่ายเข้ารอบตามวันที่ในใบเท่านั้น กดปิดรอบช้ากว่าวันตัดรอบ ใบที่ลงวันที่หลังวันตัดรอบก็ไม่เข้ารอบนั้น ระบบสร้างรอบถัดไปให้เองตามวันตัดรอบนี้
              เมื่อเปลี่ยนวันตัดรอบ รอบที่ยังไม่ปิดจะถูกจัดใหม่ และใบจ่ายในรอบเหล่านั้นจะย้ายไปอยู่รอบตามวันที่ของใบ รอบที่ปิดแล้วไม่เปลี่ยน
            </p>
          </Card>
          <Card className="flex flex-col gap-4 p-6">
            <div className="overflow-x-auto">
              <table className="t">
                <thead>
                  <tr>
                    <th>รอบ</th>
                    <th>วันเริ่ม</th>
                    <th>วันสิ้นสุด</th>
                    <th>สถานะ</th>
                    <th>
                      <span className="sr-only">แก้ไข</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{thaiMonthShort(c.start)}</td>
                      <td>{thaiShort(c.start)}</td>
                      <td>{thaiShort(c.end)}</td>
                      <td>
                        <Pill tone={c.status === "closed" ? "off" : c.isCurrent ? "ok" : "wait"}>
                          {c.status === "closed" ? "ปิดแล้ว" : c.future ? "ยังไม่เริ่ม สร้างอัตโนมัติ" : c.isCurrent ? "รอบนี้" : "ยังไม่ปิด"}
                        </Pill>
                      </td>
                      <td>
                        {c.status === "open" && (
                          <button type="button" className={rowLink} onClick={() => open(c)}>
                            แก้ไข
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[14px] text-muted">แก้วันที่ของรอบใดรอบหนึ่งได้จนกว่ารอบนั้นจะปิด (กรณีพิเศษที่ไม่ตรงวันตัดรอบ) รอบที่ปิดแล้วแก้วันที่ไม่ได้ รอบต้องต่อกันโดยไม่มีวันว่างและไม่ซ้อนกัน</p>
          </Card>
        </div>

        {cur && (
          <div role="form" aria-label="แก้วันที่ของรอบ" className="min-w-0 flex-[1_1_340px]">
            <Card className="flex flex-col gap-4 p-6">
              <CardTitle>แก้วันที่ของรอบ {thaiMonthShort(cur.start)}</CardTitle>
              <Field label="วันเริ่ม" htmlFor="sc-from" hint={prev ? `ต้องเป็นวันถัดจากวันสิ้นสุดของรอบ ${thaiMonthShort(prev.start)}` : undefined}>
                <input id="sc-from" type="date" className={`${fieldClass} disabled:bg-page disabled:text-muted`} value={s} disabled={!!prev} onChange={(ev) => setS(ev.target.value)} />
              </Field>
              <Field label="วันสิ้นสุด" htmlFor="sc-to" hint={next ? `รอบ ${thaiMonthShort(next.start)} จะเลื่อนวันเริ่มตามให้เอง` : undefined}>
                <input id="sc-to" type="date" className={fieldClass} value={e} onChange={(ev) => setE(ev.target.value)} />
              </Field>
              {error && (
                <p role="alert" className="text-[14px] text-repair">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" disabled={busy} onClick={save}>
                  บันทึกวันที่
                </Button>
                <Button onClick={() => setEditing(null)}>ยกเลิก</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
      {done && <Toast key={done.n}>{done.text}</Toast>}
    </>
  );
}
