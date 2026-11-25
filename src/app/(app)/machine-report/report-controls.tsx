"use client";

import { useRouter } from "next/navigation";
import { thaiMonthShort } from "@/domain/thai-date";
import { fieldClass } from "@/components/ui";

type Props = { month: string; months: string[]; thisMonth: string; from: string; to: string; projectId: string | null; projects: { id: string; code: string; name: string }[] };

/** เดือนหรือรอบ · ตั้งแต่ / ถึงวันที่ (changing a date makes it "กำหนดช่วงวันที่เอง") · โครงการ */
export function ReportControls({ month, months, thisMonth, from, to, projectId, projects }: Props) {
  const router = useRouter();
  const go = (p: { month?: string; from?: string; to?: string; project?: string | null }) => {
    const q = new URLSearchParams();
    const m = p.month ?? month;
    q.set("month", m);
    if (m === "custom") {
      q.set("from", p.from ?? from);
      q.set("to", p.to ?? to);
    }
    const proj = p.project === undefined ? projectId : p.project;
    if (proj) q.set("project", proj);
    router.push(`/machine-report?${q}`);
  };
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-0 flex-[0_1_220px] flex-col gap-1.5">
        <label htmlFor="fr-month" className="text-sm">
          เดือนหรือรอบ
        </label>
        <select id="fr-month" value={month} onChange={(e) => go({ month: e.target.value })} className={fieldClass}>
          {months.map((m) => (
            <option key={m} value={m}>
              {thaiMonthShort(`${m}-01`)}
              {m === thisMonth ? " (รอบนี้)" : ""}
            </option>
          ))}
          <option value="custom">กำหนดช่วงวันที่เอง</option>
        </select>
      </div>
      <div className="flex min-w-0 flex-[0_1_160px] flex-col gap-1.5">
        <label htmlFor="fr-from" className="text-sm">
          ตั้งแต่วันที่
        </label>
        <input id="fr-from" type="date" value={from} onChange={(e) => e.target.value && go({ month: "custom", from: e.target.value })} className={fieldClass} />
      </div>
      <div className="flex min-w-0 flex-[0_1_160px] flex-col gap-1.5">
        <label htmlFor="fr-to" className="text-sm">
          ถึงวันที่
        </label>
        <input id="fr-to" type="date" value={to} onChange={(e) => e.target.value && go({ month: "custom", to: e.target.value })} className={fieldClass} />
      </div>
      <div className="flex min-w-0 flex-[0_1_200px] flex-col gap-1.5">
        <label htmlFor="fr-proj" className="text-sm">
          โครงการ
        </label>
        <select id="fr-proj" value={projectId ?? ""} onChange={(e) => go({ project: e.target.value || null })} className={fieldClass}>
          {projects.map((p) => (
            <option key={p.id} value={p.id} title={p.name}>
              {p.code}
            </option>
          ))}
          <option value="">ทุกโครงการ</option>
        </select>
      </div>
    </div>
  );
}
