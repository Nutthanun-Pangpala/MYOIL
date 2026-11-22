import Link from "next/link";
import { Fragment } from "react";
import { Card, linkButton } from "@/components/ui";
import { isMonth } from "@/domain/iso-date";
import { formatBaht } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { loadMonthly } from "@/server/monthly/monthly-service";
import { MonthlyFilters } from "./monthly-filters";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const DASH = "–";

export default async function MonthlyPage({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const month = isMonth(one(sp.month)) ? one(sp.month) : today.slice(0, 7);
  const v = await loadMonthly(session, month, today, one(sp.project) || null);
  const days = Array.from({ length: (v.all ?? v.one)!.days }, (_, i) => i + 1);
  const firstProject = v.projects[0]?.id;
  const exportQs = `month=${month}${v.projectId ? `&project=${v.projectId}` : ""}`;

  const tab = (active: boolean) =>
    `inline-flex min-h-[42px] items-center px-4 font-display text-[15px] ${active ? "bg-earth text-white" : "bg-card text-ink"}`;

  const cell = (liters: number, date: string, project?: string) =>
    liters === 0 ? (
      <td className="z">{DASH}</td>
    ) : (
      <td>
        <a
          href={`/issues?from=${date}&to=${date}${project ? `&project=${project}` : ""}`}
          className="text-ink hover:text-earth"
          aria-label={`ใบจ่ายวันที่ ${date}`}
        >
          {formatBaht(liters).replace(/\.00$/, "")}
        </a>
      </td>
    );
  const dateOf = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const n = (x: number) => (x === 0 ? DASH : formatBaht(x).replace(/\.00$/, ""));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-semibold leading-snug">ตารางรายเดือน</h1>
          <p className="text-muted">
            สรุปปริมาณน้ำมันเติมเครื่องจักรประจำเดือน{v.projectId ? " ของหนึ่งโครงการ" : ""} หน่วยเป็นลิตร
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {firstProject && (
            <div role="group" aria-label="มุมมอง" className="flex self-end overflow-hidden rounded-control border border-idle">
              <Link href={`/monthly?month=${month}`} aria-pressed={!v.projectId} className={tab(!v.projectId)}>
                ทุกโครงการ
              </Link>
              <Link href={`/monthly?month=${month}&project=${v.projectId ?? firstProject}`} aria-pressed={!!v.projectId} className={tab(!!v.projectId)}>
                หนึ่งโครงการ
              </Link>
            </div>
          )}
          <MonthlyFilters month={month} months={v.months} projectId={v.projectId} projects={v.projects} />
          <a href={`/monthly/export?${exportQs}`} className={`${linkButton("secondary")} self-end`}>
            ส่งออก Excel
          </a>
        </div>
      </header>

      <Card className="p-4">
        {(v.all ?? v.one)!.rows.length === 0 ? (
          <p className="py-8 text-center text-muted">ยังไม่มีการจ่ายน้ำมันในเดือนนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="m">
              <thead>
                <tr>
                  {v.one ? (
                    <>
                      <th scope="col" className="idx">ลำดับ</th>
                      <th scope="col" className="name second">รายการเครื่องจักร</th>
                      <th scope="col" style={{ textAlign: "left" }}>รหัสทรัพย์สิน</th>
                    </>
                  ) : (
                    <th scope="col" className="name">โครงการ</th>
                  )}
                  {days.map((d) => (
                    <th key={d} scope="col">{d}</th>
                  ))}
                  <th scope="col" className="sum">{v.one ? "ปริมาณรวม" : "รวม (ลิตร)"}</th>
                </tr>
              </thead>
              <tbody>
                {v.all?.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="name">{r.label}</th>
                    {r.days.map((l, i) => (
                      <Fragment key={i}>{cell(l, dateOf(i + 1), r.key)}</Fragment>
                    ))}
                    <td className="sum">{formatBaht(r.total).replace(/\.00$/, "")}</td>
                  </tr>
                ))}
                {v.one?.rows.map((r) => (
                  <tr key={r.key}>
                    <td className="idx">{r.no}</td>
                    <th scope="row" className="name second">{r.label}</th>
                    <td className="!text-left text-muted">{r.isRented ? "เช่า" : (r.assetCode ?? "")}</td>
                    {r.days.map((l, i) => (
                      <Fragment key={i}>{cell(l, dateOf(i + 1), v.projectId!)}</Fragment>
                    ))}
                    <td className="sum">{formatBaht(r.total).replace(/\.00$/, "")}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  {v.one ? (
                    <>
                      <td className="idx" />
                      <th scope="row" className="name second">รวมต่อวัน</th>
                      <td />
                    </>
                  ) : (
                    <th scope="row" className="name">รวมต่อวัน</th>
                  )}
                  {(v.all ?? v.one)!.dayTotals.map((t, i) => (
                    <td key={i} className={t === 0 ? "z" : ""}>{n(t)}</td>
                  ))}
                  <td className="sum">{formatBaht((v.all ?? v.one)!.grandTotal).replace(/\.00$/, "")}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <p className="text-sm text-muted">
        ตารางนี้นับทุกใบที่จ่ายน้ำมันจริง ยกเว้นใบที่ยกเลิก คอลัมน์ชื่อและคอลัมน์รวมตรึงอยู่กับที่ขณะเลื่อนซ้ายขวา กดตัวเลขในช่องเพื่อดูใบจ่ายของโครงการและวันนั้น
      </p>
    </>
  );
}
