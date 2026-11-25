"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Shot } from "@/domain/driver-fill";
import { capture } from "@/lib/driver/photo";
import { btnYellow } from "./flow";

type State = "starting" | "live" | "denied" | "broken";

/**
 * The in-app camera (design boards Camera, CameraDenied): back camera only, no album, no file input.
 * `stamp` lines are burnt into the picture. Needs https (or localhost).
 */
export function Camera({ hint, stamp, onShot }: { hint: string; stamp: () => string[]; onShot: (s: Shot) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>("starting");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let live = true;
    setState("starting");
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("no camera api", "NotSupportedError");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (!live) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play().catch(() => undefined);
        setState("live");
      } catch (e) {
        if (!live) return;
        const name = e instanceof DOMException ? e.name : "";
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "broken");
      }
    })();
    return () => {
      live = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [attempt]);

  const take = useCallback(async () => {
    if (!video.current || busy) return;
    setBusy(true);
    try {
      onShot(await capture(video.current, stamp(), new Date()));
    } finally {
      setBusy(false);
    }
  }, [busy, onShot, stamp]);

  if (state === "denied" || state === "broken") {
    return (
      <div className="flex flex-1 flex-col gap-[12px] text-white" data-testid="camera-denied">
        <h2 className="font-display text-[23px] font-semibold leading-[1.3]">แอปยังใช้กล้องไม่ได้</h2>
        <p>ต้องมีรูปทุกครั้งที่บันทึก ให้อนุญาตกล้องก่อน ทำครั้งเดียว</p>
        <ol className="flex flex-col gap-[8px]">
          {["กดรูปแม่กุญแจ หรือ ⋮ ข้างที่อยู่เว็บ ด้านบนของจอ", "เลือก กล้อง แล้วเลือก อนุญาต", "กลับมาที่หน้านี้ แล้วกด ลองเปิดกล้องอีกครั้ง"].map((t, i) => (
            <li key={t} className="flex items-center gap-[12px] rounded-[14px] bg-tank px-[14px] py-[10px]">
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-safety font-display font-semibold text-ink">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <p className="text-[14px] text-tank-text">ถ้ากล้องเสีย หรืออนุญาตแล้วยังใช้ไม่ได้ ให้เขียนใบจ่ายกระดาษจากเล่มสำรองบนรถ แล้วส่งให้แอดมินสโตร์กลาง ใบที่ทำค้างไว้ในแอปไม่หาย</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${btnYellow} mt-auto`}>
          ลองเปิดกล้องอีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-[12px]">
      <div className="relative w-full flex-1 overflow-hidden rounded-[20px] bg-black" style={{ minHeight: 320 }}>
        <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" data-testid="camera-live" />
        <span aria-hidden="true" className="absolute inset-x-[10%] top-[32%] h-[30%] rounded-[14px] border-[3px] border-safety" />
        <p className="absolute inset-x-0 bottom-[10px] text-center text-[15px] text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">{state === "starting" ? "กำลังเปิดกล้อง" : hint}</p>
      </div>
      <button
        type="button"
        aria-label="ถ่ายรูป"
        disabled={state !== "live" || busy}
        onClick={take}
        className="flex size-[84px] shrink-0 items-center justify-center rounded-full border-[5px] border-white bg-safety disabled:opacity-40"
      >
        <span className="size-[58px] rounded-full border-2 border-ink" />
      </button>
      <span className="text-center text-[14px] text-tank-text">ใช้กล้องในแอปเท่านั้น เลือกรูปจากอัลบั้มไม่ได้</span>
    </div>
  );
}
