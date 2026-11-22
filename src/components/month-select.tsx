"use client";

import { useRouter } from "next/navigation";
import { thaiMonthShort } from "@/domain/thai-date";

/** "เดือน" dropdown of a month page: choosing a month opens that page for it */
export function MonthSelect({ id, path, month, months }: { id: string; path: string; month: string; months: string[] }) {
  const router = useRouter();
  return (
    <div className="flex min-w-0 flex-[0_0_180px] flex-col gap-1.5">
      <label htmlFor={id} className="text-sm">
        เดือน
      </label>
      <select
        id={id}
        value={month}
        onChange={(e) => router.push(`${path}?month=${e.target.value}`)}
        className="h-11 w-full rounded-control border border-idle bg-card px-3"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {thaiMonthShort(`${m}-01`)}
          </option>
        ))}
      </select>
    </div>
  );
}
