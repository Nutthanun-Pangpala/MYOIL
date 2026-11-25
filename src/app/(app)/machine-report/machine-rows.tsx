"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Pill, ProjectChip } from "@/components/ui";
import { thaiShort } from "@/domain/thai-date";
import { formatBaht, formatLiters } from "@/lib/format";
import type { MachineRow } from "@/server/reports/machine-report";

/** one row per machine; the arrow opens each fill with its slip and meter photo */
export function MachineRows({ rows, allProjects }: { rows: MachineRow[]; allProjects: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => (rows[0] ? { [rows[0].machineId]: true } : {}));
  const max = Math.max(1, ...rows.map((r) => r.liters));
  return (
    <tbody>
      {rows.map((r) => {
        const shown = !!open[r.machineId];
        return (
          <Fragment key={r.machineId}>
            <tr>
              <td className="w-11">
                <button
                  type="button"
                  aria-expanded={shown}
                  aria-controls={`fills-${r.machineId}`}
                  aria-label={`ดูแต่ละครั้งที่เติมของ ${r.label}`}
                  onClick={() => setOpen({ ...open, [r.machineId]: !shown })}
                  className="inline-flex size-11 items-center justify-center rounded-control border border-idle bg-card text-ink hover:bg-page"
                >
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${shown ? "rotate-180" : ""}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </td>
              <td className="font-display text-base font-medium">{r.label}</td>
              <td className="n">{r.fills.length}</td>
              <td className="w-[28%]">
                <span aria-hidden className="block h-2.5 rounded-[5px] bg-line">
                  <span className="block h-2.5 rounded-[5px] bg-safety shadow-[inset_0_0_0_1px_var(--color-safety-deep)]" style={{ width: `${Math.round((r.liters / max) * 100)}%` }} />
                </span>
              </td>
              <td className="n font-semibold">{formatLiters(r.liters)}</td>
              <td className="n">
                {formatBaht(r.amount)}
                {r.unpriced > 0 && <span className="block text-[13px] text-muted">+ รอราคา {r.unpriced} ครั้ง</span>}
              </td>
            </tr>
            {shown && (
              <tr id={`fills-${r.machineId}`}>
                <td />
                <td colSpan={5} className="px-3 pb-[18px] pt-1">
                  <div className="overflow-x-auto rounded-[14px] border border-line bg-page px-3 py-1.5">
                    <table className="t">
                      <thead>
                        <tr>
                          <th>วันที่</th>
                          <th>เลขที่ใบ</th>
                          {allProjects && <th>โครงการ</th>}
                          <th>ที่มา</th>
                          <th>รูปมิเตอร์</th>
                          <th className="n">ลิตร</th>
                          <th className="n">ยอดเงิน (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.fills.map((f) => (
                          <tr key={f.lineId}>
                            <td className="whitespace-nowrap">{thaiShort(f.date)}</td>
                            <td className="whitespace-nowrap">
                              <Link href={`/issues/${f.issueId}`} className="text-earth underline hover:text-ink">
                                {f.bookNo} / {f.docNo}
                              </Link>
                            </td>
                            {allProjects && (
                              <td>
                                <ProjectChip code={f.projectRef} />
                              </td>
                            )}
                            <td>
                              <span className="flex flex-wrap gap-1">
                                {f.source === "mobile" ? <Pill tone="ok">มือถือ</Pill> : <Pill tone="off">กระดาษ</Pill>}
                                {f.pendingReview && <Pill tone="wait">รอตรวจ</Pill>}
                              </span>
                            </td>
                            <td>
                              {f.hasPhoto ? (
                                <a href={`/api/issue-line-photo/${f.lineId}`} target="_blank" rel="noreferrer" title="กดเพื่อขยาย">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={`/api/issue-line-photo/${f.lineId}`} alt={`รูปมิเตอร์ ${r.label} วันที่ ${thaiShort(f.date)}`} className="h-12 w-20 rounded-lg bg-tank object-cover" />
                                </a>
                              ) : (
                                <span className="text-muted">ไม่มีรูปมิเตอร์</span>
                              )}
                            </td>
                            <td className="n">{formatLiters(f.liters)}</td>
                            <td className="n">{f.amount === null ? "รอราคา" : formatBaht(f.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </tbody>
  );
}
