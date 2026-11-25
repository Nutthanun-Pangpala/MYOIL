"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera } from "@/components/driver/camera";
import { Notice, Screen, btnLine, btnYellow, linkBtn } from "@/components/driver/flow";
import { bangkok, type Shot } from "@/domain/driver-fill";
import { thaiLong } from "@/domain/thai-date";
import { sendOrKeep } from "@/lib/driver/outbox";
import { shotUrl } from "@/lib/driver/photo";

const field = "min-h-[58px] min-w-0 flex-1 bg-transparent px-[16px] font-display text-[22px] outline-none";
const box = "flex items-center rounded-[16px] border-2 border-idle bg-card pr-[14px] focus-within:border-earth";
const num = (s: string) => s.replace(/,/g, "").trim();
/** what the boxes accept as it is typed: digits and one point, two decimals at most (OBS-29) */
export function money(typed: string): string {
  const t = typed.replace(/[^\d.]/g, "");
  const i = t.indexOf(".");
  return i < 0 ? t.slice(0, 10) : `${t.slice(0, i).slice(0, 10)}.${t.slice(i + 1).replace(/\./g, "").slice(0, 2)}`;
}
const isMoney = (s: string) => /^\d{1,10}(\.\d{1,2})?$/.test(num(s)) && Number(num(s)) > 0;

export function RefillForm({ driverName }: { driverName: string }) {
  const router = useRouter();
  const [liters, setLiters] = useState("");
  const [amount, setAmount] = useState("");
  const [billNo, setBillNo] = useState("");
  const [photo, setPhoto] = useState<Shot | null>(null);
  const [shooting, setShooting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref] = useState(() => crypto.randomUUID());
  // a slow phone lets the driver type before the page is ready: take what is already in the boxes
  const form = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const read = (id: string) => form.current?.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "";
    setLiters((v) => v || money(read("r-l")));
    setAmount((v) => v || money(read("r-amt")));
    setBillNo((v) => v || read("r-no"));
  }, []);

  if (shooting)
    return (
      <Screen title="ถ่ายรูปบิล" sub="ให้เห็นลิตรและยอดเงินชัด" dark onBack={() => setShooting(false)}>
        <Camera
          hint="ให้บิลทั้งใบอยู่ในภาพ"
          stamp={() => {
            const now = bangkok(new Date());
            return [`${thaiLong(now.date)} ${now.time}  บิลน้ำมันเข้ารถ`, driverName];
          }}
          onShot={(s) => {
            setPhoto(s);
            setShooting(false);
          }}
        />
      </Screen>
    );

  const missing = [!isMoney(liters) && "ลิตรที่เติมเข้า (มากกว่า 0)", !isMoney(amount) && "จำนวนเงินตามบิล (มากกว่า 0)", !photo && "รูปบิล"].filter(Boolean);
  const ok = missing.length === 0;
  const save = async () => {
    setBusy(true);
    setError(null);
    const now = bangkok(new Date());
    const body = { ref, purchaseDate: now.date, recordedAt: now.stamp, liters: String(Number(num(liters))), amount: String(Number(num(amount))), billNo: billNo.trim() || null, billPhoto: { mime: "image/jpeg", ...photo! } };
    const r = await sendOrKeep({ ref, kind: "purchase", url: "/api/driver/purchases", body, label: "เติมเข้ารถ", liters: Number(num(liters)), stopId: null });
    setBusy(false);
    if (!r.ok && !r.offline) return setError(r.message);
    router.push("/driver");
    router.refresh();
  };

  return (
    <Screen
      title="เติมน้ำมันเข้ารถ"
      sub="น้ำมันที่ซื้อเข้ารถเติมน้ำมัน"
      backHref="/driver"
      dock={
        <>
          {!ok && (
            <span role="status" className="text-center text-[15px] text-muted" data-testid="refill-missing">
              ยังบันทึกไม่ได้ ขาด {missing.join(" · ")}
            </span>
          )}
          <button type="button" className={btnYellow} disabled={!ok || busy} onClick={save}>
            {busy ? "กำลังบันทึก" : "บันทึก"}
          </button>
        </>
      }
    >
      <div ref={form} className="contents">
      <div className="flex flex-col gap-[6px]">
        <label htmlFor="r-l">ลิตรที่เติมเข้า</label>
        <div className={box}>
          <input id="r-l" inputMode="decimal" value={liters} onChange={(e) => setLiters(money(e.target.value))} className={field} />
          <span className="text-muted">ลิตร</span>
        </div>
      </div>
      <div className="flex flex-col gap-[6px]">
        <label htmlFor="r-amt">จำนวนเงินตามบิล</label>
        <div className={box}>
          <input id="r-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(money(e.target.value))} className={field} />
          <span className="text-muted">บาท</span>
        </div>
      </div>
      <div className="flex flex-col gap-[6px]">
        <span>
          รูปบิล <span className="text-muted">(ต้องมี ถ่ายด้วยกล้องในแอป)</span>
        </span>
        {photo ? (
          <div className="flex items-center gap-[12px] rounded-[16px] border border-line bg-card p-[10px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shotUrl(photo)} alt="รูปบิลที่ถ่ายแล้ว" className="size-[84px] rounded-[10px] object-cover" />
            <span className="flex flex-1 flex-col text-[15px] text-muted">
              ถ่ายแล้ว {thaiLong(photo.takenAt.slice(0, 10))} {photo.takenAt.slice(11, 16)}
              <button type="button" className={`${linkBtn} self-start`} onClick={() => setShooting(true)}>
                ถ่ายใหม่
              </button>
            </span>
          </div>
        ) : (
          <button type="button" className={btnLine} onClick={() => setShooting(true)}>
            ถ่ายรูปบิล
          </button>
        )}
      </div>
      <div className="flex flex-col gap-[6px]">
        <label htmlFor="r-no">
          เลขที่บิล <span className="text-muted">(ไม่บังคับ)</span>
        </label>
        <div className={box}>
          <input id="r-no" value={billNo} onChange={(e) => setBillNo(e.target.value)} maxLength={40} className={field} />
        </div>
      </div>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <p className="text-[14px] text-muted">ลิตรจะเข้ายอดในรถทันที ส่วนราคาแอดมินสโตร์กลางเป็นคนยืนยัน หลังบันทึกรายการนี้จะขึ้นว่า รอแอดมินยืนยัน</p>
    </Screen>
  );
}
