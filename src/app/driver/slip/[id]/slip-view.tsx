"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Notice, Screen, Sheet, Thumb, btnLine, btnYellow, linkBtn } from "@/components/driver/flow";
import { MachineArt } from "@/components/driver/machine-art";
import { SignaturePad, type SignatureHandle } from "@/components/driver/signature-pad";
import { bangkok, machineArt, siteName } from "@/domain/driver-fill";
import { thaiLong } from "@/domain/thai-date";
import { post } from "@/lib/driver/outbox";
import type { DriverSlip } from "@/server/driver/slip-service";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const pill = "inline-flex items-center gap-[6px] whitespace-nowrap rounded-full py-[3px] pl-[10px] pr-[12px] text-[14px] font-medium";

export function SlipView({ slip, when }: { slip: DriverSlip; when: string }) {
  const router = useRouter();
  const [big, setBig] = useState<DriverSlip["lines"][number] | null>(null);
  const [signing, setSigning] = useState(false);
  const total = Math.round(slip.lines.reduce((a, l) => a + l.liters, 0) * 100) / 100;

  if (signing) return <LateSign slip={slip} total={total} onBack={() => setSigning(false)} onDone={() => (setSigning(false), router.refresh())} />;

  return (
    <Screen
      title={`ใบจ่ายของ ${slip.code}`}
      sub={when}
      backHref="/driver"
      dock={
        <>
          {!slip.signed && !slip.cancelled && (
            <button type="button" className={btnYellow} onClick={() => setSigning(true)}>
              ขอลายเซ็นรับ
            </button>
          )}
          <a href="/driver" className={slip.signed || slip.cancelled ? btnYellow : btnLine}>
            กลับหน้าหลัก
          </a>
        </>
      }
    >
      <div className="flex flex-col gap-[8px]">
        <div className="flex flex-col gap-[2px]">
          <span className="break-words font-display text-[22px] font-semibold leading-[1.25]" data-testid="slip-site">
            {siteName(slip.name, slip.code)}
          </span>
          {slip.detail && <span className="text-[15px] text-muted">{slip.detail}</span>}
        </div>
        <div className="flex items-baseline justify-between gap-[10px]">
          <span className="text-muted">เลขที่ใบ</span>
          <span className="font-display text-[18px] font-medium" data-testid="slip-no">
            {slip.no}
          </span>
        </div>
        <div className="flex flex-wrap gap-[6px]">
          {slip.cancelled ? (
            <span className={`${pill} bg-repair-soft text-repair-ink`}>แอดมินยกเลิกใบนี้แล้ว</span>
          ) : (
            <>
              <span className={`${pill} bg-working-soft text-working-ink`}>
                <span aria-hidden="true" className="size-[8px] rounded-full bg-working" />
                ส่งแล้ว
              </span>
              {slip.signed ? (
                <span className={`${pill} bg-working-soft text-working-ink`}>
                  <span aria-hidden="true" className="size-[8px] rounded-full bg-working" />
                  เซ็นรับแล้ว
                </span>
              ) : (
                <span className={`${pill} bg-safety-soft text-warn-ink`}>
                  <span aria-hidden="true" className="size-[8px] rounded-full bg-safety-deep" />
                  ยังไม่เซ็นรับ
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <ul className="rounded-[16px] border border-line bg-card px-[14px] py-[2px]">
        {slip.lines.map((l) => (
          <li key={l.id} className="flex min-h-[68px] items-center gap-[10px]">
            <MachineArt kind={machineArt(l.machine, l.type)} name={l.machine} w={60} h={52} />
            <Thumb src={`/api/driver/line-photo/${l.id}`} alt={`รูปมิเตอร์ของ ${l.machine}`} onOpen={() => setBig(l)} size={44} />
            <span className="min-w-0 flex-1 font-display text-[17px] font-medium leading-[1.25]">{l.machine}</span>
            <span className="whitespace-nowrap font-display text-[20px] font-semibold">{fmt(l.liters)} ลิตร</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[19px] font-medium">รวม {slip.lines.length} เครื่อง</span>
        <span className="font-display text-[34px] font-semibold leading-[1.1]">
          {fmt(total)}
          <span className="text-[18px] font-normal"> ลิตร</span>
        </span>
      </div>
      <section className="flex items-center gap-[12px] rounded-[16px] border border-line bg-card px-[14px] py-[10px]">
        {slip.signed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/driver/signature-photo/${slip.id}`} alt={`ลายเซ็นของ ${slip.receiverName ?? "ผู้รับ"}`} className="h-[56px] w-[120px] shrink-0 object-cover object-top" onError={(e) => (e.currentTarget.style.display = "none")} />
        )}
        <div className="flex flex-col">
          <span className="text-[14px] text-muted">{slip.signed ? "ผู้เซ็นรับ" : "เหตุผลที่ยังไม่เซ็นรับ"}</span>
          <span className="font-display text-[18px] font-medium">{slip.signed ? (slip.receiverName ?? "–") : (slip.unsignedReason ?? "–")}</span>
        </div>
      </section>
      <p className="text-[14px] text-muted">
        {slip.signed ? "แก้เครื่องจักรและลิตรไม่ได้แล้ว ถ้าผิดให้แจ้งแอดมินสโตร์กลาง" : "ใบนี้ส่งถึง MYOIL แล้ว และยังไม่ถูกเรียกเก็บจนกว่าจะเซ็นรับ"} กดรูปมิเตอร์เพื่อดูรูปใหญ่
      </p>
      <Sheet open={!!big} title={big ? `${big.machine} ${fmt(big.liters)} ลิตร` : ""} onClose={() => setBig(null)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {big && <img src={`/api/driver/line-photo/${big.id}`} alt={`รูปมิเตอร์ของ ${big.machine}`} className="w-full rounded-[14px]" />}
        <button type="button" className={btnLine} onClick={() => setBig(null)}>
          ปิด
        </button>
      </Sheet>
    </Screen>
  );
}

/** the receiver signs later, on a slip already sent "ยังไม่เซ็นรับ" */
function LateSign({ slip, total, onBack, onDone }: { slip: DriverSlip; total: number; onBack: () => void; onDone: () => void }) {
  const pad = useRef<SignatureHandle>(null);
  const [name, setName] = useState("");
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatureRef] = useState(() => crypto.randomUUID());

  const send = async () => {
    setBusy(true);
    setError(null);
    const now = bangkok(new Date());
    const image = await pad.current!.toShot([`ผู้รับ ${name.trim()}`, `${thaiLong(now.date)} ${now.time}  ${slip.code}  ${fmt(total)} ลิตร`, siteName(slip.name, slip.code)]);
    const r = await post(`/api/driver/issues/${slip.ref}/signature`, { signatureRef, receiverName: name.trim(), signedAt: now.stamp, image: { mime: "image/jpeg", ...image } });
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.offline ? "ไม่มีสัญญาณ ลายเซ็นยังไม่ถูกส่ง ย้ายไปจุดที่มีสัญญาณแล้วกดอีกครั้ง" : r.message);
  };

  return (
    <Screen
      title="ขอลายเซ็นรับ"
      sub={`ใบ ${slip.no} ของ ${slip.code}`}
      onBack={onBack}
      dock={
        <button type="button" className={btnYellow} disabled={!name.trim() || !ink || busy} onClick={send}>
          {busy ? "กำลังส่ง" : "ยืนยันรับน้ำมัน"}
        </button>
      }
    >
      <div className="flex items-baseline justify-between rounded-[16px] bg-tank px-[16px] py-[10px] text-white">
        <span>รวม {slip.lines.length} เครื่อง</span>
        <span className="font-display text-[28px] font-semibold text-safety">
          {fmt(total)} <span className="text-[16px] font-normal text-page">ลิตร</span>
        </span>
      </div>
      <div className="flex flex-col gap-[6px]">
        <label htmlFor="ls-name">ชื่อผู้เซ็นรับ</label>
        <input id="ls-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="พิมพ์ชื่อผู้รับน้ำมัน" autoComplete="off" className="min-h-[58px] rounded-[16px] border-2 border-idle bg-card px-[16px] text-[18px]" />
      </div>
      <div className="flex flex-col gap-[6px]">
        <div className="flex items-center justify-between">
          <span>เซ็นด้วยนิ้วในกรอบ</span>
          <button type="button" className={linkBtn} onClick={() => pad.current?.clear()}>
            ล้างลายเซ็น
          </button>
        </div>
        <SignaturePad ref={pad} onInk={setInk} />
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
    </Screen>
  );
}
