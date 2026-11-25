/**
 * The fuel truck drawn in design "MYOIL — หน้าจอฝั่ง พขร. (ขั้นที่ 2)" (login header, tank card).
 * `level` 0–1 = how full the tank looks. Decorative: the number next to it says the liters.
 */
const WAVE = "M-240 0 q30 -7 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V150 H-240 Z";

export function TruckArt({ id, level, width = 150 }: { id: string; level: number; width?: number }) {
  const p = Math.max(0, Math.min(1, level));
  const y = p <= 0 ? 190 : 57 + 114 * (1 - p);
  return (
    <svg aria-hidden="true" viewBox="24 36 616 196" className="block shrink-0" style={{ width, height: "auto" }}>
      <defs>
        <clipPath id={id}>
          <rect x="49" y="57" width="386" height="114" rx="41" />
        </clipPath>
      </defs>
      <rect x="36" y="176" width="590" height="16" rx="4" className="fill-idle" />
      <rect x="252" y="190" width="118" height="28" rx="5" className="fill-idle" />
      <rect x="150" y="41" width="46" height="14" rx="4" className="fill-page" />
      <rect x="290" y="41" width="46" height="14" rx="4" className="fill-page" />
      <rect x="438" y="148" width="20" height="12" className="fill-idle" />
      <rect x="44" y="52" width="396" height="124" rx="46" className="fill-tank-deep" />
      <g clipPath={`url(#${id})`}>
        <g transform={`translate(0 ${y})`}>
          <path d={WAVE} className="fill-safety" />
        </g>
      </g>
      <rect x="44" y="52" width="396" height="124" rx="46" fill="none" strokeWidth="6" className="stroke-page" />
      <path d="M456 176 V102 a12 12 0 0 1 12 -12 H548 a12 12 0 0 1 9 4 l46 50 a12 12 0 0 1 3 8 V176 Z" className="fill-page" />
      <path d="M514 102 H545 l37 41 H514 Z" className="fill-tank" />
      {[120, 196, 540].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="202" r="27" strokeWidth="2" className="fill-tank-deep stroke-muted" />
          <circle cx={cx} cy="202" r="12" className="fill-page" />
        </g>
      ))}
    </svg>
  );
}

/** small truck icon of the next stop and the empty route */
export function TruckIcon() {
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
      <rect x="2" y="9" width="15" height="9" rx="4" className="fill-ink" />
      <path d="M18 18v-6h4l3 3.4V18z" className="fill-ink" />
      <circle cx="8" cy="20" r="2.6" strokeWidth="1.4" className="fill-ink stroke-safety" />
      <circle cx="21" cy="20" r="2.6" strokeWidth="1.4" className="fill-ink stroke-safety" />
    </svg>
  );
}
