import type { MachineArtKind } from "@/domain/driver-fill";

/** the small picture of a machine in the driver's lists (design boards Fill, Machines, Sign, Detail): sky, ground, and one of three machines */
export function MachineArt({ kind, name, w, h }: { kind: MachineArtKind; name: string; w: number; h: number }) {
  return (
    <span
      role="img"
      aria-label={`ภาพประกอบ ${name}`}
      className="relative block shrink-0 overflow-hidden rounded-[10px] bg-[linear-gradient(180deg,var(--color-art-sky)_0,var(--color-art-sky)_76%,var(--color-art-ground)_76%,var(--color-art-ground)_100%)]"
      style={{ width: w, height: h }}
    >
      <svg aria-hidden="true" viewBox="0 0 120 84" preserveAspectRatio="xMidYMax meet" className="block size-full">
        {kind === "forklift" ? (
          <>
            <rect x="36" y="14" width="4" height="46" className="fill-art-dark" />
            <path d="M37 56 H16" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-art-dark" />
            <path d="M50 38 V20 H72 V38" fill="none" strokeWidth="3" className="stroke-art-dark" />
            <rect x="42" y="37" width="38" height="18" rx="3" className="fill-safety-line" />
            <circle cx="51" cy="58" r="6" className="fill-art-dark" />
            <circle cx="73" cy="58" r="6" className="fill-art-dark" />
          </>
        ) : kind === "truck" ? (
          <>
            <rect x="16" y="24" width="58" height="29" rx="2" className="fill-art-box" />
            <path d="M77 53 V31 h13 l11 11 v11 z" className="fill-art-cab" />
            <path d="M81 35 h8 l7 7 h-15 z" className="fill-art-glass" />
            <rect x="16" y="52" width="85" height="4" className="fill-art-dark" />
            <circle cx="30" cy="59" r="6" className="fill-art-dark" />
            <circle cx="44" cy="59" r="6" className="fill-art-dark" />
            <circle cx="90" cy="59" r="6" className="fill-art-dark" />
          </>
        ) : (
          <>
            <rect x="30" y="53" width="46" height="10" rx="5" className="fill-art-dark" />
            <rect x="34" y="39" width="34" height="14" rx="2" className="fill-safety-line" />
            <rect x="52" y="26" width="16" height="15" rx="2" className="fill-safety-line" />
            <rect x="55" y="29" width="10" height="8" rx="1" className="fill-art-glass" />
            <path d="M40 41 L23 16 L11 35" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="stroke-safety-line" />
            <path d="M11 34 l-7 9 h12 z" className="fill-art-dark" />
          </>
        )}
      </svg>
    </span>
  );
}
