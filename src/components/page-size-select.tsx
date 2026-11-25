"use client";

import { useRouter } from "next/navigation";

/** "ใบต่อหน้า" 20 / 50 / 100 — each choice is a ready-made link */
export function PageSizeSelect({ id, label, size, links }: { id: string; label: string; size: number; links: Record<string, string> }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={String(size)} onChange={(e) => router.push(links[e.target.value])} className="h-11 w-[88px] rounded-control border border-idle bg-card px-3 text-ink">
        {Object.keys(links).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
