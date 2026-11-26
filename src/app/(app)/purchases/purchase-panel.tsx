"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button, Card, linkButton } from "@/components/ui";
import { FIELD_NAME, completePurchase } from "@/domain/purchase-calc";
import { thaiShort } from "@/domain/thai-date";
import { formatBaht } from "@/lib/format";
import { savePurchaseAction, updatePurchaseAction } from "./actions";
import { shrinkImage } from "@/lib/image-shrink";

/** OBS-41: these boxes take digits, one dot and thousands commas only — letters and a minus sign never get in */
const digits = (s: string) => {
  const t = s.replace(/[^\d.,]/g, "");
  const i = t.indexOf(".");
  return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, "");
};

const toNum = (s: string): number | null => {
  const t = s.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

type Err = { field?: "date" | "time" | "liters" | "price" | "amount" | "photo" | "reason"; text: string };

const input = "h-11 w-full rounded-control border bg-card px-3";
const label = "text-sm";
const optional = <span className="text-muted">(ไม่บังคับ)</span>;

/** the form on the right of the page (design 6.6): opened by ?new=purchase, closes back to the list */
export function PurchasePanel({
  mode,
  month,
  today,
  initialDate,
  initialPrice,
  editing,
}: {
  /** only purchases now: the daily price list was cut on 25 Nov 2026 (a slip uses the price of its bill) */
  mode: "purchase";
  /** a saved purchase being changed (OBS-18) */
  editing?: { id: string; date: string; time: string | null; liters: number; price: number; amount: number; billNo: string; note: string };
  month: string;
  today: string;
  initialDate: string;
  initialPrice: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isPurchase = mode === "purchase";

  const [date, setDate] = useState(editing?.date ?? (initialDate || (isPurchase ? today : "")));
  // the time on the bill: with the date it decides which bill is used up first (brief §14 B9)
  const [time, setTime] = useState(editing ? (editing.time ?? "") : "");
  useEffect(() => {
    if (!editing) setTime((t) => t || new Date(Date.now() + 7 * 3_600_000).toISOString().slice(11, 16));
  }, [editing]);
  const [liters, setLiters] = useState(editing ? String(editing.liters) : "");
  const [price, setPrice] = useState(editing ? String(editing.price) : initialPrice === null ? "" : String(initialPrice));
  const [amount, setAmount] = useState(""); // editing: liters × price recompute it
  const [billNo, setBillNo] = useState(editing?.billNo ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<{ mime: string; base64: string } | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [error, setError] = useState<Err | null>(null);
  const [notes, setNotes] = useState<string[] | null>(null); // saved, but there is something to read
  const [odd, setOdd] = useState<string[] | null>(null); // looks odd: asked before saving (OBS-17)
  /** OBS-41: the boxes still needed (fewer than two of three filled) are marked, not only named */
  const [missing, setMissing] = useState<("liters" | "price" | "amount")[]>([]);
  // a changed value needs a fresh question, and a message about the old value goes away at once (OBS-41)
  useEffect(() => {
    setOdd(null);
    setError(null);
    setMissing([]);
  }, [date, time, liters, price, amount]);

  // OBS-39: the form opens under the list on a phone — bring it into view and put the cursor in the first box to fill
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const f = formRef.current;
    if (!f) return;
    f.scrollIntoView({ block: "start", behavior: "smooth" });
    f.querySelector<HTMLInputElement>("#p-l")?.focus({ preventScroll: true });
  }, []);

  // two of three filled → show the third as a hint (the server recomputes on save)
  const calc = useMemo(
    () => (isPurchase ? completePurchase({ liters: toNum(liters), price: toNum(price), amount: toNum(amount) }) : null),
    [isPurchase, liters, price, amount],
  );
  const hint = (field: "liters" | "price" | "amount") => {
    if (!calc?.ok) return "";
    const empty = { liters: !toNum(liters), price: !toNum(price), amount: !toNum(amount) }[field];
    return empty ? formatBaht(calc[field]) : "";
  };

  const back = () => router.push(`/purchases?month=${(notes ? date.slice(0, 7) : "") || month}`);

  function submit(e: { preventDefault(): void }, confirmed = false) {
    e.preventDefault();
    setError(null);
    // "12a" is not a number: say so at that box instead of treating it as left empty (OBS-27)
    const boxes = [["liters", liters], ["price", price], ["amount", amount]] as const;
    const at = (field: "liters" | "price" | "amount") => formRef.current?.querySelector<HTMLInputElement>({ liters: "#p-l", price: "#p-price", amount: "#p-amt" }[field])?.focus();
    for (const [field, text] of boxes) {
      const n = toNum(text);
      if (text.trim() !== "" && n === null) return (at(field), setError({ field, text: `${FIELD_NAME[field]} ต้องเป็นตัวเลข` }));
      if (n !== null && !(n > 0)) return (at(field), setError({ field, text: `${FIELD_NAME[field]} ต้องมากกว่า 0` }));
    }
    const empty = boxes.filter(([, text]) => text.trim() === "").map(([f]) => f);
    if (empty.length > 1) {
      at(empty[0]);
      setMissing(empty);
      return setError({ text: `กรอกอย่างน้อยสองช่องจากลิตร ราคา และจำนวนเงิน (ยังขาด ${empty.map((f) => FIELD_NAME[f]).join(" ")})` });
    }
    // owner, 26 Nov 2026: a new bill always carries its photo (the price of the slips comes from it)
    if (!editing && !photo) {
      formRef.current?.querySelector<HTMLElement>("label[for='p-photo']")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return setError({ field: "photo", text: "แนบรูปบิลก่อนบันทึก ราคาของใบจ่ายมาจากบิลใบนี้" });
    }
    start(async () => {
      const body = { date, time, liters: toNum(liters), price: toNum(price), amount: toNum(amount), billNo, note, reason, billPhoto: photo, confirmed };
      const r = editing ? await updatePurchaseAction(editing.id, body) : await savePurchaseAction(body);
      if (!r.ok) {
        if (r.field === "reason") formRef.current?.querySelector<HTMLInputElement>("#p-why")?.focus();
        return r.confirm ? setOdd(r.confirm) : setError({ field: r.field, text: r.error });
      }
      router.refresh();
      if (r.warnings.length > 0) return setNotes(r.warnings);
      router.push(`/purchases?month=${date.slice(0, 7) || month}`);
    });
  }

  const border = (f: Err["field"]) => (error?.field === f || (missing as string[]).includes(f ?? "") ? "border-repair" : "border-idle");
  // OBS-40: what the system fills in, shown as soon as two of the three boxes have a number
  const filled = calc?.ok ? (["liters", "price", "amount"] as const).filter((f) => !toNum({ liters, price, amount }[f])) : [];
  /** OBS-17: the third box shows the number the system worked out, in the box itself (plain digits, so it can be edited); what is sent is still only what was typed */
  const shown = (f: "liters" | "price" | "amount", typed: string) => (typed === "" && calc?.ok && filled.length === 1 && filled[0] === f ? calc[f].toFixed(2) : typed);
  const UNIT = { liters: "ลิตร", price: "บาท/ลิตร", amount: "บาท" } as const;
  const title = editing ? "แก้ไขการซื้อ" : "บันทึกการซื้อ";

  return (
    <Card className="min-w-0 flex-[1_1_340px] p-6">
      <form ref={formRef} onSubmit={submit} aria-label={title} className="flex scroll-mt-4 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-medium leading-snug">{title}</h2>
          <button type="button" onClick={back} disabled={pending} className="min-h-11 px-2 text-earth underline">
            {notes ? "รับทราบ" : "ปิด"}
          </button>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="p-date" className={label}>
            วันที่
          </label>
          <input id="p-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={`${input} ${border("date")}`} />
          {/* OBS-44: the browser's date box shows a Western year; the list shows the Thai one — say both */}
          {date && <span className="text-[13px] text-muted">ตรงกับ {thaiShort(date)} ในรายการ</span>}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="p-time" className={label}>
            เวลาบนบิล
          </label>
          <input id="p-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required={!editing || editing.time !== null} className={`${input} ${border("time")}`} />
          <span className="text-[13px] text-muted">
            {editing && editing.time === null ? "บิลนี้บันทึกไว้ก่อนมีช่องเวลา ระบบถือเป็น 00:00 จนกว่าจะใส่เวลาบนบิล" : "น้ำมันของบิลที่เข้าก่อนถูกใช้ก่อน ระบบเรียงบิลตามวันที่และเวลานี้"}
          </span>
        </div>

        {isPurchase && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="p-l" className={label}>
              เติมเข้า (ลิตร)
            </label>
            <input id="p-l" inputMode="decimal" value={shown("liters", liters)} onChange={(e) => setLiters(digits(e.target.value))} placeholder={hint("liters")} className={`${input} ${border("liters")} text-right tabular-nums`} />
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="p-price" className={label}>
            ราคาต่อลิตร (บาท)
          </label>
          <input id="p-price" inputMode="decimal" value={shown("price", price)} onChange={(e) => setPrice(digits(e.target.value))} placeholder={isPurchase ? hint("price") : ""} className={`${input} ${border("price")} text-right tabular-nums`} />
        </div>

        {isPurchase && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="p-amt" className={label}>
                จำนวนเงิน (บาท)
              </label>
              <input id="p-amt" inputMode="decimal" value={shown("amount", amount)} onChange={(e) => setAmount(digits(e.target.value))} placeholder={hint("amount")} className={`${input} ${border("amount")} text-right tabular-nums`} />
              <span className="text-[13px] text-muted">กรอกสองช่องจากลิตร ราคา และจำนวนเงิน ระบบคิดช่องที่เหลือให้</span>
              {calc?.ok && filled.length === 1 && (
                <span aria-live="polite" data-testid="p-calc" className="rounded-control bg-idle-soft px-3 py-2 text-sm text-earth">
                  ระบบคิดให้: {FIELD_NAME[filled[0]]} {formatBaht(calc[filled[0]])} {UNIT[filled[0]]} ตรวจกับบิลก่อนบันทึก
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="p-bill" className={label}>
                เลขที่บิลหรือใบกำกับภาษี {optional}
              </label>
              <input id="p-bill" value={billNo} onChange={(e) => setBillNo(e.target.value)} className={`${input} border-idle`} />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="p-note" className={label}>
                หมายเหตุ {optional}
              </label>
              <input id="p-note" value={note} onChange={(e) => setNote(e.target.value)} className={`${input} border-idle`} />
            </div>
            {editing && (
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="p-why" className={label}>
                  เหตุผลที่แก้ไข
                </label>
                <input id="p-why" value={reason} onChange={(e) => (setReason(e.target.value), setError(null))} maxLength={300} placeholder="เช่น คีย์ลิตรผิดจากบิล" className={`${input} ${border("reason")}`} />
                <span className="text-[13px] text-muted">ต้องใส่ทุกครั้งที่แก้ เหตุผลจะอยู่ในประวัติของรายการซื้อ</span>
              </div>
            )}
            {!editing && (
            <div className="flex min-w-0 flex-col gap-1.5">
              {/* design 6.6: a "เลือกรูป" button, not the browser's file box */}
              <span id="p-photo-label" className={label}>
                รูปบิล <span className="text-muted">(ต้องแนบ)</span>
              </span>
              <div className="flex flex-wrap items-center gap-3">
              <input
                id="p-photo"
                type="file"
                aria-labelledby="p-photo-label"
                accept="image/jpeg,image/png"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  setError(null);
                  if (!f) return (setPhoto(null), setPhotoName(""));
                  const small = await shrinkImage(f);
                  if (!small) return (setPhoto(null), setPhotoName(""), setError({ field: "photo", text: "เปิดรูปนี้ไม่ได้ เลือกไฟล์ JPG หรือ PNG" }));
                  setPhoto(small);
                  setPhotoName(f.name);
                }}
                className="peer sr-only"
              />
              <label htmlFor="p-photo" className={`${linkButton("secondary")} cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-earth`}>
                เลือกรูป
              </label>
              {photoName ? <span className="text-[13px] text-muted">แนบแล้ว: {photoName}</span> : <span className={`text-[13px] ${error?.field === "photo" ? "text-repair" : "text-muted"}`}>ยังไม่ได้แนบ ไฟล์ JPG หรือ PNG</span>}
              </div>
            </div>
            )}
          </>
        )}

        {notes && (
          <div role="status" className="flex flex-col gap-1 rounded-control bg-idle-soft px-3 py-2 text-sm text-earth">
            <p className="font-semibold">บันทึกแล้ว</p>
            {notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-control bg-repair-soft px-3 py-2 text-sm text-repair">
            {error.text}
          </p>
        )}

        {odd && (
          <div role="alert" className="flex flex-col gap-2 rounded-control bg-safety-soft px-3 py-3 text-sm">
            <strong>ตรวจก่อนบันทึก</strong>
            <ul className="list-disc pl-5">
              {odd.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            <span>ถ้าถูกต้องตามบิล กดยืนยันบันทึก ถ้าไม่ใช่ แก้ข้อมูลด้านบน</span>
            <Button type="button" variant="primary" disabled={pending} onClick={(e) => submit(e, true)}>
              {pending ? "กำลังบันทึก…" : "ยืนยันบันทึก"}
            </Button>
          </div>
        )}

        {!odd && (
          <Button type="submit" variant="primary" disabled={pending || notes !== null} className="w-full">
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        )}
      </form>
    </Card>
  );
}
