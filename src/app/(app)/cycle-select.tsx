"use client";

import { useRouter } from "next/navigation";
import { thaiMonth } from "@/domain/thai-date";

/** "ดูเดือนอื่น" on the overview (becomes "ดูรอบอื่น" once claim cycles exist) */
export function CycleSelect({ month, months }: { month: string; months: string[] }) {
  const router = useRouter();
  return (
    <div className="flex min-w-0 flex-[0_0_220px] flex-col gap-1.5">
      <label htmlFor="ov-month" className="text-sm">
        ดูเดือนอื่น
      </label>
      <select id="ov-month" value={month} onChange={(e) => router.push(`/?month=${e.target.value}`)} className="h-11 w-full rounded-control border border-idle bg-card px-3">
        {months.map((m) => (
          <option key={m} value={m}>
            {thaiMonth(`${m}-01`)}
          </option>
        ))}
      </select>
    </div>
  );
}
