"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { completePurchase } from "@/domain/purchase-calc";
import { formatBaht } from "@/lib/format";
import { savePriceAction, savePurchaseAction, updatePurchaseAction } from "./actions";

const toNum = (s: string): number | null => {
  const t = s.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

type Err = { field?: "date" | "liters" | "price" | "amount" | "photo"; text: string };

/** downsize a picked image to ≤ 1280 px JPEG so it stays well under 1 MB */
async function shrink(file: File): Promise<{ mime: string; base64: string } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.8);
    return { mime: "image/jpeg", base64: url.slice(url.indexOf(",") + 1) };
  } catch {
    return null;
  }
}

const input = "h-11 w-full rounded-control border bg-card px-3";
const label = "text-sm";
const optional = <span className="text-muted">(ไม่บังคับ)</span>;

/** the form on the right of the page (design 6.6): opened by ?new=purchase|price, closes back to the list */
export function PurchasePanel({
  mode,
  month,
  today,
  initialDate,
  initialPrice,
  editing,
}: {
  mode: "purchase" | "price";
  /** a saved purchase being changed (OBS-18) */
  editing?: { id: string; date: string; liters: number; price: number; amount: number; billNo: string; note: string };
  month: string;
  today: string;
  initialDate: string;
  initialPrice: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isPurchase = mode === "purchase";

  const [date, setDate] = useState(editing?.date ?? (initialDate || (isPurchase ? today : "")));
  const [liters, setLiters] = useState(editing ? String(editing.liters) : "");
  const [price, setPrice] = useState(editing ? String(editing.price) : initialPrice === null ? "" : String(initialPrice));
  const [amount, setAmount] = useState(""); // editing: liters × price recompute it
  const [billNo, setBillNo] = useState(editing?.billNo ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [photo, setPhoto] = useState<{ mime: string; base64: string } | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [error, setError] = useState<Err | null>(null);
  const [notes, setNotes] = useState<string[] | null>(null); // saved, but there is something to read
  const [odd, setOdd] = useState<string[] | null>(null); // looks odd: asked before saving (OBS-17)
  useEffect(() => setOdd(null), [date, liters, price, amount]); // a changed number needs a fresh question

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
    start(async () => {
      const body = { date, liters: toNum(liters), price: toNum(price), amount: toNum(amount), billNo, note, billPhoto: photo, confirmed };
      const r = isPurchase ? (editing ? await updatePurchaseAction(editing.id, body) : await savePurchaseAction(body)) : await savePriceAction({ date, price: toNum(price) });
      if (!r.ok) return r.confirm ? setOdd(r.confirm) : setError({ field: r.field, text: r.error });
      router.refresh();
      if (r.warnings.length > 0) return setNotes(r.warnings);
      router.push(`/purchases?month=${date.slice(0, 7) || month}`);
    });
  }

  const border = (f: Err["field"]) => (error?.field === f ? "border-repair" : "border-idle");
  const title = isPurchase ? (editing ? "แก้ไขการซื้อ" : "บันทึกการซื้อ") : "ตั้งราคาประจำวัน";

  return (
    <Card className="min-w-0 flex-[1_1_340px] p-6">
      <form onSubmit={submit} aria-label={title} className="flex flex-col gap-4">
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
        </div>

        {isPurchase && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="p-l" className={label}>
              เติมเข้า (ลิตร)
            </label>
            <input id="p-l" inputMode="decimal" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder={hint("liters")} className={`${input} ${border("liters")} text-right tabular-nums`} />
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="p-price" className={label}>
            ราคาต่อลิตร (บาท)
          </label>
          <input id="p-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={isPurchase ? hint("price") : ""} className={`${input} ${border("price")} text-right tabular-nums`} />
        </div>

        {isPurchase && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="p-amt" className={label}>
                จำนวนเงิน (บาท)
              </label>
              <input id="p-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={hint("amount")} className={`${input} ${border("amount")} bg-page text-right tabular-nums`} />
              <span className="text-[13px] text-muted">ระบบคิดให้จากลิตรและราคา กรอกสองช่องจากสามช่อง ช่องที่เหลือเติมเอง</span>
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
            {!editing && (
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="p-photo" className={label}>
                รูปบิล {optional}
              </label>
              <input
                id="p-photo"
                type="file"
                accept="image/jpeg,image/png"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  setError(null);
                  if (!f) return (setPhoto(null), setPhotoName(""));
                  const small = await shrink(f);
                  if (!small) return (setPhoto(null), setPhotoName(""), setError({ field: "photo", text: "เปิดรูปนี้ไม่ได้ เลือกไฟล์ JPG หรือ PNG" }));
                  setPhoto(small);
                  setPhotoName(f.name);
                }}
                className={`${input} border-idle py-2`}
              />
              {photoName && <span className="text-[13px] text-muted">แนบแล้ว: {photoName}</span>}
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
            <strong>ตรวจก่อนบันทึก ตัวเลขนี้ดูผิดปกติ</strong>
            <ul className="list-disc pl-5">
              {odd.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            <span>ถ้าถูกต้องตามบิล กดยืนยันบันทึก ถ้าไม่ใช่ แก้ตัวเลขด้านบน</span>
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
