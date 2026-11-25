import Link from "next/link";
import { FilterForm } from "@/components/filter-form";
import { Pager, pageFrom, sizeFrom } from "@/components/pager";
import { Card, Field, Pill, ProjectChip, StateBox, fieldClass, linkButton, type Tone } from "@/components/ui";
import { sumAmounts, sumLiters } from "@/domain/money";
import { thaiShort } from "@/domain/thai-date";
import { formatBaht, formatLiters } from "@/lib/format";
import { canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { ISSUE_STATES, listIssues, machineOptions, projectOptions, type IssueBadge } from "@/server/issues/issue-service";
import { STATE_LABEL, issueFiltersFrom } from "./list-filters";

export const metadata = { title: "ใบจ่ายน้ำมัน" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

const BADGE: Record<IssueBadge, { tone: Tone; text: string }> = {
  unsigned: { tone: "wait", text: "ยังไม่เซ็นรับ" },
  pending_review: { tone: "wait", text: "รอตรวจ" },
  pending_price: { tone: "wait", text: "รอราคา" },
  invoiced: { tone: "ok", text: "อยู่ในใบแจ้งแล้ว" },
  cancelled: { tone: "off", text: "ยกเลิก" },
};

/** design 6.3 */
export default async function IssuesPage({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  const sp = await searchParams;
  const get = (k: string) => one(sp[k]);
  const { badDate, ...f } = issueFiltersFrom(get);

  const [rows, projects, machines] = await Promise.all([listIssues(session, f), projectOptions(session), machineOptions()]);

  const size = sizeFrom(get("size"));
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = pageFrom(get("page"), pages);
  const shown = rows.slice((page - 1) * size, page * size);

  // the address of this list without the page: filters + size
  const keep: Record<string, string> = {
    from: f.from ?? "",
    to: f.to ?? "",
    project: f.projectId ?? "",
    machine: f.machine ?? "",
    status: f.state ?? f.status ?? "",
    q: f.q ?? "",
    signed: f.unsigned ? "no" : "",
    review: f.review ?? "",
  };
  const qs = (extra: Record<string, string>) => new URLSearchParams(Object.entries({ ...keep, ...extra }).filter(([, v]) => v)).toString();
  const href = (p: number, s: number) => `/issues?${qs({ size: s === 20 ? "" : String(s), page: p === 1 ? "" : String(p) })}`;

  const cancelled = rows.filter((r) => r.badges.includes("cancelled"));
  const counted = rows.filter((r) => !r.badges.includes("cancelled"));
  const totalLiters = sumLiters(counted.map((r) => r.liters));
  const totalAmount = sumAmounts(counted.map((r) => r.amount ?? 0));
  const filtered = Object.values(keep).some(Boolean);
  const writer = canWriteFuel(session);
  // a machine that is not in the list any more (merged away) still shows as chosen
  const machineCodes = machines.map((m) => m.code);
  if (f.machine && !machineCodes.includes(f.machine)) machineCodes.unshift(f.machine);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-[34px] font-semibold leading-[1.3]">ใบจ่ายน้ำมัน</h1>
          <p className="text-muted">คีย์จากใบเบิกน้ำมันเชื้อเพลิงกระดาษ ค้นหา และตรวจย้อนหลัง</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href={`/issues/export?${qs({})}`} className={linkButton("secondary")}>
            ส่งออก Excel
          </a>
          {writer && (
            <Link href="/issues/new" className={linkButton("primary")}>
              บันทึกใบจ่าย
            </Link>
          )}
        </div>
      </header>

      <Card className="px-6 py-5">
        <FilterForm action="/issues" className="flex flex-wrap items-end gap-4">
          <Field label="ตั้งแต่วันที่" htmlFor="f-from" className="flex-[0_1_160px]">
            <input id="f-from" type="date" name="from" defaultValue={f.from ?? ""} className={fieldClass} />
          </Field>
          <Field label="ถึงวันที่" htmlFor="f-to" className="flex-[0_1_160px]">
            <input id="f-to" type="date" name="to" defaultValue={f.to ?? ""} className={fieldClass} />
          </Field>
          <Field label="โครงการ" htmlFor="f-proj" className="flex-[1_1_160px]">
            <select id="f-proj" name="project" defaultValue={f.projectId ?? ""} className={fieldClass}>
              <option value="">ทุกโครงการ</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id} title={p.name}>
                  {p.refCode}
                </option>
              ))}
            </select>
          </Field>
          <Field label="เครื่องจักร" htmlFor="f-mach" className="flex-[1_1_160px]">
            <select id="f-mach" name="machine" defaultValue={f.machine ?? ""} className={fieldClass}>
              <option value="">ทุกเครื่อง</option>
              {machineCodes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="สถานะ" htmlFor="f-st" className="flex-[1_1_160px]">
            <select id="f-st" name="status" defaultValue={f.state ?? ""} className={fieldClass}>
              <option value="">ทุกสถานะ</option>
              {ISSUE_STATES.map((s) => (
                <option key={s} value={s}>
                  {STATE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ค้นหาเลขที่ใบ" htmlFor="f-q" className="flex-[1_1_180px]">
            <input id="f-q" type="search" name="q" defaultValue={f.q ?? ""} placeholder="เช่น 11445" className={fieldClass} />
          </Field>
          {get("size") && <input type="hidden" name="size" value={String(size)} />}
          {f.unsigned && <input type="hidden" name="signed" value="no" />}
          {f.review && <input type="hidden" name="review" value="pending" />}
        </FilterForm>
        {(f.unsigned || f.review) && (
          <p className="mt-3 text-sm text-muted">
            {f.unsigned ? "แสดงเฉพาะใบที่ยังไม่เซ็นรับ" : "แสดงเฉพาะใบจากมือถือที่รอตรวจ"}{" "}
            <Link href={`/issues?${qs({ signed: "", review: "" })}`} className="text-earth underline hover:text-ink">
              แสดงทุกใบ
            </Link>
          </p>
        )}
        {badDate && (
          <p role="status" className="mt-3 text-sm text-warn-ink">
            วันที่ในลิงก์ไม่ถูกต้อง จึงไม่ได้ใช้เป็นตัวกรอง เลือกวันที่ใหม่
          </p>
        )}
      </Card>

      <Card className="p-6">
        {rows.length === 0 ? (
          filtered ? (
            <StateBox
              title={f.from || f.to ? "ไม่มีใบจ่ายในช่วงวันที่นี้" : "ไม่พบใบจ่ายที่ตรงกับตัวกรอง"}
              actions={
                <>
                  <Link href="/issues" className={linkButton("secondary")}>
                    ล้างตัวกรอง
                  </Link>
                  {writer && (
                    <Link href="/issues/new" className={linkButton("primary")}>
                      บันทึกใบจ่าย
                    </Link>
                  )}
                </>
              }
            >
              ลองขยายช่วงวันที่ หรือล้างตัวกรองที่เลือกไว้
            </StateBox>
          ) : (
            <StateBox
              title="ยังไม่มีใบจ่าย"
              actions={
                writer && (
                  <Link href="/issues/new" className={linkButton("primary")}>
                    บันทึกใบจ่าย
                  </Link>
                )
              }
            >
              ใบจ่ายที่คีย์จากใบเบิกกระดาษ หรือที่ส่งมาจากมือถือของ พขร. จะขึ้นที่นี่
            </StateBox>
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="t">
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>เล่มที่ / เลขที่</th>
                    <th>โครงการ</th>
                    <th>รายการเครื่องจักร</th>
                    <th className="n">ลิตร</th>
                    <th className="n">ยอดเงิน (บาท)</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const off = r.badges.includes("cancelled");
                    const strike = off ? "text-muted line-through" : "";
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{thaiShort(r.issueDate)}</td>
                        <td className="whitespace-nowrap">
                          <Link href={`/issues/${r.id}`} className="text-earth underline hover:text-ink">
                            {r.bookNo} / {r.docNo}
                          </Link>
                        </td>
                        <td>
                          <ProjectChip code={r.projectRef} name={r.projectName} />
                        </td>
                        <td>{r.machines.join(" + ")}</td>
                        <td className={`n ${strike}`}>{formatLiters(r.liters)}</td>
                        <td className={`n ${strike}`}>{r.amount === null ? "รอราคา" : formatBaht(r.amount)}</td>
                        <td>
                          <span className="flex flex-wrap gap-1">
                            {r.badges.length === 0 ? (
                              <Pill tone="ok">ปกติ</Pill>
                            ) : (
                              r.badges.map((b) => (
                                <Pill key={b} tone={BADGE[b].tone}>
                                  {BADGE[b].text}
                                </Pill>
                              ))
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>
                      รวมทุกหน้าของผลที่กรองอยู่ {counted.length} ใบ{cancelled.length > 0 && ` ไม่นับใบที่ยกเลิก ${cancelled.length} ใบ`}
                    </td>
                    <td className="n">{formatLiters(totalLiters)}</td>
                    <td className="n">{formatBaht(totalAmount)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <Pager id="issues" label="หน้าของรายการใบจ่าย" unit="ใบ" total={rows.length} page={page} size={size} href={href} />
          </>
        )}
      </Card>
    </>
  );
}
