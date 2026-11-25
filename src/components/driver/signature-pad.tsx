"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Shot } from "@/domain/driver-fill";
import { encode } from "@/lib/driver/photo";

export type SignatureHandle = {
  /** the signature as a JPEG on white, with `lines` (name · day and time · project) printed under it */
  toShot: (lines: string[]) => Promise<Shot>;
  clear: () => void;
};

/** the receiver signs with a finger (design board Sign). `onInk` tells the page whether anything is drawn. */
export const SignaturePad = forwardRef<SignatureHandle, { onInk: (has: boolean) => void }>(function SignaturePad({ onInk }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [has, setHas] = useState(false);

  useEffect(() => {
    const c = canvas.current!;
    const k = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * k);
    c.height = Math.round(c.clientHeight * k);
    const g = c.getContext("2d")!;
    g.scale(k, k);
    g.lineWidth = 3;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#211a15";
  }, []);

  const at = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const mark = () => {
    if (!has) {
      setHas(true);
      onInk(true);
    }
  };

  useImperativeHandle(ref, () => ({
    clear() {
      const c = canvas.current!;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      setHas(false);
      onInk(false);
    },
    async toShot(lines) {
      const src = canvas.current!;
      const w = 640;
      const h = Math.round((src.height / src.width) * w);
      const size = 18;
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h + lines.length * size * 1.5 + 12;
      const g = out.getContext("2d")!;
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, out.width, out.height);
      g.drawImage(src, 0, 0, w, h);
      g.fillStyle = "#211a15";
      g.font = `${size}px "IBM Plex Sans Thai", Tahoma, sans-serif`;
      g.textBaseline = "top";
      lines.forEach((t, i) => g.fillText(t, 10, h + 4 + i * size * 1.5));
      return encode(out, new Date(), 120_000);
    },
  }));

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={has ? "ลายเซ็นผู้รับ เซ็นแล้ว" : "กรอบเซ็นชื่อ ยังไม่ได้เซ็น"}
      data-testid="signature-pad"
      className="h-[170px] min-h-[120px] w-full flex-1 touch-none rounded-[16px] border-2 border-dashed border-earth bg-card"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = at(e);
        // a tap leaves a dot
        const g = canvas.current!.getContext("2d")!;
        g.beginPath();
        g.arc(last.current.x, last.current.y, 1.5, 0, Math.PI * 2);
        g.stroke();
        mark();
      }}
      onPointerMove={(e) => {
        if (!last.current) return;
        const p = at(e);
        const g = canvas.current!.getContext("2d")!;
        g.beginPath();
        g.moveTo(last.current.x, last.current.y);
        g.lineTo(p.x, p.y);
        g.stroke();
        last.current = p;
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  );
});
