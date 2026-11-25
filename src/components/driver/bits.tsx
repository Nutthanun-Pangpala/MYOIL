import type { ReactNode } from "react";

/**
 * Small pieces of the driver's phone screens. Look = design "BookCare — คนขับรถน้ำมัน (แบบ UX/UI)"
 * (https://claude.ai/artifact/2N4LwyuGCDCRogY9Tze8HZ), moved here from BookCare on 25 Nov 2026 (owner).
 */

type Tone = "ok" | "wait" | "bad" | "note";
const TONE: Record<Tone, string> = {
  ok: "bg-working-soft text-working",
  wait: "bg-idle-soft text-earth",
  bad: "bg-repair-soft text-repair",
  note: "bg-safety-soft text-ink",
};

/** status always as a word on a tinted pill (never colour alone) */
export function DPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-[10px] py-[3px] text-[14px] font-semibold leading-normal ${TONE[tone]}`}>{children}</span>;
}

/** brown project code tag (PCOB) */
export function ProjectTag({ code, size = 16 }: { code: string; size?: 14 | 16 | 18 }) {
  const fs = { 14: "text-[14px]", 16: "text-[16px]", 18: "text-[18px]" }[size];
  return <span className={`inline-flex shrink-0 rounded-[6px] bg-earth px-[9px] py-[2px] font-display font-semibold leading-normal text-white ${fs}`}>{code}</span>;
}

export function AdminNote({ note, big = false }: { note: string; big?: boolean }) {
  return (
    <div className="rounded-control bg-page px-[12px] py-[8px]">
      <p className="text-[14px] font-semibold text-muted">หมายเหตุจากแอดมิน</p>
      <p className={big ? "text-[17px]" : "text-[16px]"}>{note}</p>
    </div>
  );
}

/** "นำทางไป PCOB": MYOIL keeps no coordinates of a project, so Google Maps searches its name */
export function NavButton({ code, name }: { code: string; name: string }) {
  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name || code)}`}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-[56px] w-full items-center justify-center gap-[8px] rounded-control border-[1.5px] border-ink bg-card font-display text-[16px] font-semibold text-ink no-underline"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11l18-8-8 18-2-8-8-2z" />
      </svg>
      นำทางไป {code}
    </a>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** liters in the truck: big number, "จาก 6,000 ลิตร" and a bar when the tank size is set */
export function TankFigure({ liters, capacity, label }: { liters: number; capacity: number | null; label: string }) {
  const pct = capacity ? Math.max(0, Math.min(100, (liters / capacity) * 100)) : null;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
      <span className="text-[14px] font-semibold text-muted">{label}</span>
      <span className="flex items-baseline gap-[6px]">
        <span className="font-display text-[28px] font-semibold leading-[1.1]" data-testid="driver-tank">
          {fmt(liters)}
        </span>
        <span className="text-[14px] font-semibold text-muted">{capacity ? `จาก ${fmt(capacity)} ลิตร` : "ลิตร"}</span>
      </span>
      {pct != null && (
        <span aria-hidden="true" className="block h-[8px] overflow-hidden rounded-full bg-idle-soft">
          <span className="block h-[8px] bg-earth" style={{ width: `${pct}%` }} />
        </span>
      )}
    </div>
  );
}

export const card = "rounded-card border border-line bg-card";
