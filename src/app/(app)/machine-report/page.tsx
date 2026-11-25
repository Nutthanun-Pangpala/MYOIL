import Link from "next/link";
import { Card, PageHeader, StateBox, linkButton } from "@/components/ui";
import { thaiRange } from "@/domain/thai-date";
import { formatBaht, formatLiters } from "@/lib/format";
import { canOpen } from "@/lib/nav";
import { requireUser } from "@/lib/session";
import { ledgerMonths } from "@/server/ledger/ledger-service";
import { projectOptions } from "@/server/issues/issue-service";
import { loadMachineReport } from "@/server/reports/machine-report";
import { MachineRows } from "./machine-rows";
import { ReportControls } from "./report-controls";
import { reportRange } from "./report-filters";

export const metadata = { title: "รายงานเครื่องจักร" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

/** design "ขั้นที่ 2 รายงานตามเครื่องจักร" */
export default async function MachineReportPage({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  const sp = await searchParams;
  const get = (k: string) => one(sp[k]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const range = reportRange(get, today);
  const [projects, months] = await Promise.all([projectOptions(session), ledgerMonths(today)]);
  const picked = projects.find((p) => p.id === get("project")) ?? null;
  const report = await loadMachineReport(session, { from: range.from, to: range.to, projectId: picked?.id ?? null });
  const thisMonth = today.slice(0, 7);
  const monthList = months.includes(thisMonth) ? months : [thisMonth, ...months];
  const exportQs = new URLSearchParams({ from: range.from, to: range.to, ...(picked ? { project: picked.id } : {}) });
  const scopeName = picked ? picked.refCode : "ทุกโครงการ";

  return (
    <>
      <PageHeader
        title="รายงานตามเครื่องจักร"
        sub="แต่ละโครงการเติมให้เครื่องไหน กี่ครั้ง กี่ลิตร กดลูกศรเพื่อดูทีละครั้งพร้อมรูปมิเตอร์"
        actions={
          <a href={`/machine-report/export?${exportQs}`} className={linkButton("secondary")}>
            ส่งออก Excel
          </a>
        }
      />
      <Card className="px-6 py-5">
        <ReportControls
          month={range.month}
          months={monthList}
          thisMonth={thisMonth}
          from={range.from}
          to={range.to}
          projectId={picked?.id ?? null}
          projects={projects.map((p) => ({ id: p.id, code: p.refCode, name: p.name }))}
        />
      </Card>

      <Card className="p-6">
        {report.rows.length === 0 ? (
          <StateBox title={`ไม่มีการเติมน้ำมันของ${scopeName} ในช่วง ${thaiRange(range.from, range.to)}`}>ลองเลือกเดือนอื่น หรือเลือกทุกโครงการ</StateBox>
        ) : (
          <div className="overflow-x-auto">
            <table className="t">
              <thead>
                <tr>
                  <th>
                    <span className="sr-only">ดูแต่ละครั้ง</span>
                  </th>
                  <th>เครื่องจักร</th>
                  <th className="n">เติม (ครั้ง)</th>
                  <th>สัดส่วนลิตร</th>
                  <th className="n">ลิตรรวม</th>
                  <th className="n">ยอดเงิน (บาท)</th>
                </tr>
              </thead>
              <MachineRows key={`${range.from}-${range.to}-${picked?.id ?? "all"}`} rows={report.rows} allProjects={!picked} />
              <tfoot>
                <tr>
                  <td />
                  <td>
                    รวม{picked ? `โครงการ ${picked.refCode}` : "ทุกโครงการ"} {report.rows.length} เครื่อง
                  </td>
                  <td className="n">{report.fills}</td>
                  <td />
                  <td className="n">{formatLiters(report.liters)}</td>
                  <td className="n">{formatBaht(report.amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {report.rows.length > 0 && (
        <div className="rounded-control border border-line bg-card px-[18px] py-3.5">
          รายงานนี้นับทุกครั้งที่จ่ายน้ำมันจริง เหมือนตารางรายเดือน
          {report.pendingReview > 0 && ` รวมใบจากมือถือที่ยังรอตรวจ ${report.pendingReview} ใบ`} ยอดของ{scopeName}ในช่วง {thaiRange(range.from, range.to)} คือ{" "}
          <strong>{formatLiters(report.liters)} ลิตร</strong>
          {report.pendingReview > 0 && canOpen(session.role, "/check") && (
            <>
              {" "}
              <Link href="/check" className="text-earth underline hover:text-ink">
                ไปตรวจใบจากมือถือ
              </Link>
            </>
          )}
        </div>
      )}
      <p className="text-sm text-muted">ใบที่เกิดก่อนเริ่มใช้มือถือเป็นใบกระดาษ จึงไม่มีรูปมิเตอร์รายเครื่อง กดเลขที่ใบเพื่อเปิดใบนั้น</p>
    </>
  );
}
