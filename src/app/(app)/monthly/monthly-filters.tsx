"use client";

import { useRouter } from "next/navigation";
import { thaiMonthShort } from "@/domain/thai-date";

type Props = { month: string; months: string[]; projectId: string | null; projects: { id: string; code: string }[] };

const sel = "h-11 w-full rounded-control border border-idle bg-card px-3";

/** month + (optionally) one project; choosing either reloads the page with the new query */
export function MonthlyFilters({ month, months, projectId, projects }: Props) {
  const router = useRouter();
  const go = (m: string, p: string | null) => router.push(`/monthly?month=${m}${p ? `&project=${p}` : ""}`);
  return (
    <>
      {projectId && (
        <div className="flex min-w-0 flex-[0_0_160px] flex-col gap-1.5">
          <label htmlFor="mo-proj" className="text-sm">
            โครงการ
          </label>
          <select id="mo-proj" value={projectId} onChange={(e) => go(month, e.target.value)} className={sel}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex min-w-0 flex-[0_0_200px] flex-col gap-1.5">
        <label htmlFor="mo-month" className="text-sm">
          เดือน
        </label>
        <select id="mo-month" value={month} onChange={(e) => go(e.target.value, projectId)} className={sel}>
          {months.map((m) => (
            <option key={m} value={m}>
              {thaiMonthShort(`${m}-01`)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
