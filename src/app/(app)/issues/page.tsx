import Link from "next/link";
import { isIsoDate } from "@/domain/iso-date";
import { thaiShort } from "@/domain/thai-date";
import { Card, Pill, linkButton } from "@/components/ui";
import { formatBaht, formatLiters } from "@/lib/format";
import { canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { sumAmounts, sumLiters } from "@/domain/money";
import { listIssues, projectOptions, type IssueBadge } from "@/server/issues/issue-service";

export const metadata = { title: "ใบจ่ายน้ำมัน" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const BADGE: Record<IssueBadge, { tone: "ok" | "wait" | "bad"; text: string }> = {
  unsigned: { tone: "wait", text: "ยังไม่เซ็นรับ" },
  pending_review: { tone: "wait", text: "รอตรวจ" },
  pending_price: { tone: "wait", text: "รอราคา" },
  invoiced: { tone: "ok", text: "อยู่ในใบแจ้งแล้ว" },
  cancelled: { tone: "bad", text: "ยกเลิก" },
};

export default async function IssuesPage({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  const sp = await searchParams;
  const rawFrom = one(sp.from), rawTo = one(sp.to);
  const badDate = (rawFrom !== "" && !isIsoDate(rawFrom)) || (rawTo !== "" && !isIsoDate(rawTo));
  const f = { from: isIsoDate(rawFrom) ? rawFrom : "", to: isIsoDate(rawTo) ? rawTo : "", projectId: one(sp.project), q: one(sp.q), unsigned: one(sp.signed) === "no", machine: one(sp.machine), status: ["cancelled", "active"].includes(one(sp.status)) ? (one(sp.status) as "cancelled" | "active") : undefined, review: one(sp.review) === "pending" ? ("pending" as const) : undefined };

  const [rows, projects] = await Promise.all([
    listIssues(session, { from: f.from || undefined, to: f.to || undefined, projectId: f.projectId || undefined, q: f.q || undefined, unsigned: f.unsigned, machine: f.machine || undefined, status: f.status, review: f.review }),
    projectOptions(session),
  ]);

  const PAGE = 50;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const page = Math.min(pages, Math.max(1, Number(one(sp.page)) || 1));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const keep = new URLSearchParams(Object.entries({ from: f.from, to: f.to, project: f.projectId, q: f.q, machine: f.machine, status: f.status ?? "", signed: f.unsigned ? "no" : "", review: f.review ?? "" }).filter(([, v]) => v));
  const link = (p: number) => `/issues?${new URLSearchParams([...keep, ["page", String(p)]])}`;
  const counted = rows.filter((r) => !r.badges.includes("cancelled"));
  const totalLiters = sumLiters(counted.map((r) => r.liters));
  const totalAmount = sumAmounts(counted.map((r) => r.amount ?? 0));
  const input = "h-11 rounded-control border border-line bg-card px-3 text-[15px]";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-earth">ใบจ่ายน้ำมัน</h1>
        {canWriteFuel(session) && (
          <Link href="/issues/new" className={linkButton("primary")}>
            บันทึกใบจ่าย
          </Link>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          ตั้งแต่วันที่
          <input type="date" name="from" defaultValue={f.from} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          ถึงวันที่
          <input type="date" name="to" defaultValue={f.to} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          โครงการ
          <select name="project" defaultValue={f.projectId} className={input}>
            <option value="">ทุกโครงการ</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.refCode} — {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          ค้นหาเลขที่ใบ
          <input type="search" name="q" defaultValue={f.q} placeholder="เล่มที่ หรือ เลขที่" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          เครื่องจักร
          <input type="search" name="machine" defaultValue={f.machine} placeholder="เช่น PC210" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          สถานะ
          <select name="status" defaultValue={f.status ?? ""} className={input}>
            <option value="">ทั้งหมด</option>
            <option value="active">ไม่รวมที่ยกเลิก</option>
            <option value="cancelled">ที่ยกเลิก</option>
          </select>
        </label>
        {f.unsigned && <input type="hidden" name="signed" value="no" />}
        {f.review && <input type="hidden" name="review" value="pending" />}
        <button type="submit" className={linkButton()}>
          กรอง
        </button>
        <a href={`/issues/export?${keep}`} className={linkButton()}>
          ส่งออก Excel
        </a>
      </form>

      {badDate && (
        <p role="status" className="rounded-control border border-line bg-card px-4 py-3 text-sm">
          วันที่ในลิงก์ไม่ถูกต้อง จึงไม่ได้ใช้เป็นตัวกรอง เลือกวันที่ใหม่แล้วกด "กรอง"
        </p>
      )}

      <Card className="overflow-x-auto p-2">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-muted">
            {f.from || f.to || f.projectId || f.q || f.machine || f.status || f.unsigned || f.review ? "ไม่พบใบจ่ายที่ตรงกับตัวกรอง" : "ยังไม่มีใบจ่าย"}
          </p>
        ) : (
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="text-left text-muted">
                {["วันที่", "เล่มที่/เลขที่", "โครงการ", "รายการเครื่องจักร", "ลิตร", "ยอดเงิน", "สถานะ"].map((h, i) => (
                  <th key={h} className={`whitespace-nowrap px-3 py-2.5 font-medium ${i === 4 || i === 5 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-page">
                  <td className="whitespace-nowrap px-3 py-3">{thaiShort(r.issueDate)}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Link href={`/issues/${r.id}`} className="text-earth underline">
                      {r.bookNo}/{r.docNo}
                    </Link>
                  </td>
                  <td className="px-3 py-3" title={r.projectName}>
                    {r.projectRef}
                  </td>
                  <td className="px-3 py-3">{r.machines.join(", ")}</td>
                  <td className="num px-3 py-3">{formatLiters(r.liters)}</td>
                  <td className="num px-3 py-3">{r.amount === null ? "รอราคา" : formatBaht(r.amount)}</td>
                  <td className="px-3 py-3">
                    <span className="flex flex-wrap gap-1">
                      {r.badges.map((b) => (
                        <Pill key={b} tone={BADGE[b].tone}>
                          {BADGE[b].text}
                        </Pill>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink font-semibold">
                <td className="px-3 py-3" colSpan={4}>
                  รวม {counted.length} ใบ (ไม่นับใบที่ยกเลิก)
                </td>
                <td className="num px-3 py-3">{formatLiters(totalLiters)}</td>
                <td className="num px-3 py-3">{formatBaht(totalAmount)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </Card>
      {pages > 1 && (
        <nav aria-label="หน้า" className="flex items-center gap-3 text-[14px]">
          {page > 1 && <Link href={link(page - 1)} className={linkButton()}>ก่อนหน้า</Link>}
          <span>หน้า {page} / {pages} · แสดง {shown.length} จาก {rows.length} ใบ</span>
          {page < pages && <Link href={link(page + 1)} className={linkButton()}>ถัดไป</Link>}
        </nav>
      )}
    </div>
  );
}
