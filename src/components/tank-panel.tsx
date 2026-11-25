import Link from "next/link";
import type { TankLevel } from "@/domain/overview";
import { formatLiters } from "@/lib/format";

type Props = {
  level: number;
  capacity: number | null;
  tank: TankLevel;
  inToday: number;
  outToday: number;
  /** executives get the larger panel with "เต็ม/หมด" marks and no link to the ledger book */
  large?: boolean;
  asOf?: string;
  /** the person may open ตั้งค่า (admin): offer the link when the tank size is missing */
  settingsLink?: boolean;
};

const WAVE = (start: number, n: number, amp: number) => `M${start} 0 ` + Array.from({ length: n }, (_, i) => (i === 0 ? `q30 ${-amp} 60 0` : "t60 0")).join(" ") + " V150 H" + start + " Z";

function StatusPill({ status }: { status: TankLevel["status"] }) {
  // one short word; what to do about it is in the to-do list under this panel
  const [text, ok] = status === "ok" ? ["ปกติ", true] : status === "low" ? ["ใกล้หมด ควรเติม", false] : ["ติดลบ", false];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-[3px] pl-2.5 pr-3 text-[13px] font-medium ${ok ? "bg-working-soft text-working-ink" : "bg-repair-soft text-repair-ink"}`}>
      <span aria-hidden className={`h-2 w-2 rounded-full ${ok ? "bg-working" : "bg-repair"}`} />
      {text}
    </span>
  );
}

/** the odometer-style number: one dark box per digit */
function Digits({ text, negative, large }: { text: string; negative: boolean; large?: boolean }) {
  const box = large ? "h-[70px] w-[46px] rounded-[10px] text-[50px]" : "h-[52px] w-[34px] rounded-[7px] text-[36px]";
  return (
    <div aria-hidden className={`flex items-end ${large ? "gap-1.5" : "gap-1"} ${negative ? "text-tank-negative" : "text-safety"}`}>
      {[...text].map((c, i) =>
        c === "-" ? (
          // the sign is not a digit: no box, so "-250" reads as one number
          <span key={i} className={`self-center font-display font-semibold leading-none ${large ? "pr-1 text-[44px]" : "pr-0.5 text-[32px]"}`}>
            −
          </span>
        ) : c === "," ? (
          <span key={i} className={`font-display font-semibold leading-none ${large ? "pb-0.5 text-[40px]" : "pb-0.5 text-[29px]"}`}>
            ,
          </span>
        ) : (
          <span key={i} className={`inline-flex items-center justify-center bg-tank-deep font-display font-semibold leading-none shadow-[inset_0_-4px_0_rgb(0_0_0/0.4)] ${box}`}>
            {c}
          </span>
        ),
      )}
      <span className={`font-display leading-none text-page ${large ? "pb-2.5 pl-1.5 text-[22px]" : "pb-[7px] pl-1.5 text-base"}`}>ลิตร</span>
    </div>
  );
}

export function TankPanel({ level, capacity, tank, inToday, outToday, large, asOf, settingsLink }: Props) {
  const neg = tank.status === "negative";
  // no tank size: draw the tank half full so it does not look empty
  const p = capacity ? Math.max(0, Math.min(1, level / capacity)) : level > 0 ? 0.5 : 0;
  const liqY = level <= 0 ? 190 : 57 + 114 * (1 - p);
  const fuel = "var(--color-safety)";
  const clip = large ? "tank-clip" : "tank-clip-s";
  const alt = `รถเติมน้ำมัน คงเหลือ ${neg ? "ติดลบ " : ""}${tank.text.replace("-", "")} ลิตร${capacity ? ` จากความจุถัง ${formatLiters(capacity)} ลิตร` : ""}`;
  const stat = (label: string, v: number) => (
    <div className="flex flex-col gap-0.5 rounded-control bg-white/[0.08] px-4 py-2.5">
      <span className="text-[13px] text-tank-text">{label}</span>
      <span className="font-display text-xl font-medium leading-snug">{formatLiters(v)} ลิตร</span>
    </div>
  );

  return (
    <section
      aria-label="คงเหลือในรถเติมน้ำมัน"
      className={`flex flex-wrap items-center bg-tank text-white ${large ? "gap-x-10 gap-y-6 rounded-[24px] px-9 pb-6 pt-8" : "gap-x-8 gap-y-3.5 rounded-card px-7 py-[18px]"}`}
    >
      <div className={`flex min-w-0 flex-col items-start ${large ? "flex-[1_1_330px] gap-4" : "flex-[1_1_290px] gap-2.5"}`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`font-display text-page ${large ? "text-[19px]" : "text-[17px]"}`}>คงเหลือในรถเติมน้ำมัน</span>
          <StatusPill status={tank.status} />
        </div>
        <span className="sr-only">{alt}</span>
        <Digits text={tank.text} negative={neg} large={large} />
        <span className={`${large ? "" : "text-sm"} text-tank-text`}>
          {tank.percent === null ? (
            <>
              ยังไม่ได้ตั้งความจุถัง
              {settingsLink && (
                <>
                  {" "}
                  <Link href="/settings" className="text-white underline">
                    ไปตั้งค่า
                  </Link>
                </>
              )}
            </>
          ) : (
            `${tank.percent}% ของความจุถัง ${formatLiters(capacity!)} ลิตร`
          )}
          {large ? (asOf ? ` คำนวณถึง ${asOf}` : "") : null}
          {!large && (
            <>
              {" "}
              <Link href="/ledger" className="text-white underline">
                ดูสมุดคงเหลือ
              </Link>
            </>
          )}
        </span>
      </div>

      {large ? (
        <div className="order-last flex flex-wrap gap-2.5">
          {stat("เติมเข้าวันนี้", inToday)}
          {stat("จ่ายออกวันนี้", outToday)}
          <Link href="/ledger" className="w-full text-white underline">
            ดูสมุดคงเหลือรายวัน
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {stat("เติมเข้าวันนี้", inToday)}
          {stat("จ่ายออกวันนี้", outToday)}
        </div>
      )}

      <div className={`min-w-0 ${large ? "flex-[2_1_460px]" : "flex-[0_1_340px]"}`}>
        <svg role="img" aria-label={alt} viewBox="0 0 760 300" className="block h-auto w-full">
          <defs>
            <clipPath id={clip}>
              <rect x="49" y="57" width="386" height="114" rx="41" />
            </clipPath>
          </defs>
          <rect x="716" y="40" width="10" height="226" fill="#44301f" />
          <rect x="560" y="40" width="190" height="8" fill="#44301f" />
          <rect x="708" y="48" width="26" height="18" fill="#44301f" />
          <path d="M596 48 V84" fill="none" stroke="#44301f" strokeWidth="3" />
          <rect x="588" y="84" width="16" height="12" rx="2" fill="#44301f" />
          <path d="M0 266 H760" fill="none" stroke="#6f655d" strokeWidth="2" opacity="0.6" />
          <path d="M8 284 H752" fill="none" stroke="#6f655d" strokeWidth="3" strokeDasharray="26 22" opacity="0.35" />
          {large && (
            <>
              <text x="94" y="101" textAnchor="end" fontSize="17" fill="#cbbfb2">เต็ม</text>
              <text x="94" y="207" textAnchor="end" fontSize="17" fill="#cbbfb2">หมด</text>
            </>
          )}
          <g transform="translate(60 36)">
            <ellipse cx="330" cy="231" rx="300" ry="7" fill="#1c130d" />
            <rect x="36" y="176" width="590" height="16" rx="4" fill="#a08670" />
            <rect x="252" y="190" width="118" height="28" rx="5" fill="#a08670" />
            <circle cx="280" cy="204" r="6" fill="#24180f" />
            <rect x="298" y="200" width="56" height="8" rx="4" fill="#24180f" />
            <rect x="150" y="41" width="46" height="14" rx="4" fill="#f5f5f3" />
            <rect x="290" y="41" width="46" height="14" rx="4" fill="#f5f5f3" />
            <rect x="438" y="148" width="20" height="12" fill="#a08670" />
            <rect x="44" y="52" width="396" height="124" rx="46" fill="#24180f" />
            <g clipPath={`url(#${clip})`}>
              <g style={{ transform: `translateY(${liqY}px)`, transition: "transform 0.8s ease" }}>
                <path className="wave-b" d={WAVE(-270, 19, 6)} fill={fuel} opacity="0.45" />
                <path className="wave-a" d={WAVE(-240, 18, 7)} fill={fuel} />
              </g>
            </g>
            <path d="M63 142.5 H85 M52 114 H90 M63 85.5 H85" fill="none" stroke="#f5f5f3" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M180 55 V173 M316 55 V173" fill="none" stroke="#f5f5f3" strokeWidth="3" opacity="0.2" />
            <path d="M100 68 H340" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.14" />
            <rect x="44" y="52" width="396" height="124" rx="46" fill="none" stroke={neg ? "#ff8a75" : "#f5f5f3"} strokeWidth="5" />
            <path d="M456 176 V102 a12 12 0 0 1 12 -12 H548 a12 12 0 0 1 9 4 l46 50 a12 12 0 0 1 3 8 V176 Z" fill="#f5f5f3" />
            <path d="M514 102 H545 l37 41 H514 Z" fill="#33241a" />
            <path d="M505 100 V176" fill="none" stroke="#cfc8bf" strokeWidth="2" />
            <rect x="598" y="154" width="8" height="12" rx="2" fill="#ffc72c" />
            {[120, 196, 540].map((cx) => (
              <g key={cx}>
                <circle cx={cx} cy="202" r="27" fill="#120c08" stroke="#6f655d" strokeWidth="2" />
                <circle cx={cx} cy="202" r="12" fill="#f5f5f3" />
                <circle cx={cx} cy="202" r="4" fill="#a08670" />
              </g>
            ))}
          </g>
        </svg>
      </div>
    </section>
  );
}
