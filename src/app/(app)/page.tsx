import Link from "next/link";
import { TankPanel } from "@/components/tank-panel";
import { Card, Pill, linkButton } from "@/components/ui";
import { isMonth, monthRange } from "@/domain/iso-date";
import { thaiLong, thaiMonth } from "@/domain/thai-date";
import { formatBaht, formatLiters } from "@/lib/format";
import { canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { loadOverview } from "@/server/overview/overview-service";
import { CycleSelect } from "./cycle-select";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Home({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const month = isMonth(one(sp.month)) ? one(sp.month) : today.slice(0, 7);
  const v = await loadOverview(session, month, today);
  const writer = canWriteFuel(session);
  const isCurrent = month === today.slice(0, 7);
  const label = thaiMonth(`${month}-01`);

  const todo: { key: string; tag: React.ReactNode; text: string; href: string; link: string }[] = [];
  if (v.unsigned && v.unsigned.slips > 0)
    todo.push({
      key: "unsigned",
      tag: <Pill tone="wait">ใบจ่าย</Pill>,
      text: `รอเซ็นรับ ${v.unsigned.slips} ใบ รวม ${formatLiters(v.unsigned.liters)} ลิตร (ยังไม่นับในใบแจ้งค่าใช้จ่ายจนกว่าจะเซ็น)`,
      href: "/issues?signed=no",
      link: "ดูใบที่รอเซ็นรับ",
    });
  if (v.negative)
    todo.push({
      key: "negative",
      tag: <Pill tone="bad">ยอดคงเหลือ</Pill>,
      text: `ติดลบ ${v.negative.days} วัน ตั้งแต่ ${thaiLong(v.negative.first)} (เหลือ ${formatLiters(v.negative.closing)} ลิตร) ตรวจว่าคีย์ซื้อน้ำมันเข้าครบหรือยัง แล้วค่อยตรวจใบจ่ายของวันนั้น`,
      href: `/ledger?month=${v.negative.first.slice(0, 7)}`,
      link: "เปิดสมุดคงเหลือ",
    });

  const stat = (title: string, value: string, unit: string, sub: string, href: string) => (
    <Link
      key={title}
      href={href}
      className="flex flex-[1_1_240px] flex-col gap-0.5 rounded-card border border-line bg-card px-6 pb-5 pt-[18px] text-ink no-underline shadow-[0_3px_0_var(--color-line)]"
    >
      <span className="text-muted">{title}</span>
      <span className="font-display text-[34px] font-semibold leading-tight">
        {value} <span className="text-[17px] font-normal">{unit}</span>
      </span>
      <span className="text-sm text-muted">{sub}</span>
    </Link>
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-semibold leading-snug">ภาพรวม</h1>
          <p className="text-muted">วันนี้ {thaiLong(today)}</p>
        </div>
        {writer && (
          <Link href="/issues/new" className={linkButton("primary")}>
            บันทึกใบจ่าย
          </Link>
        )}
      </header>

      {v.tank && <TankPanel level={v.tank.liters} capacity={v.tank.capacity} tank={v.tank} inToday={v.tank.inToday} outToday={v.tank.outToday} large={!writer} asOf={thaiLong(today)} settingsLink={session.role === "system_admin"} />}

      {writer && todo.length > 0 && (
        <Card className="px-6 pb-2 pt-5">
          <h2 className="font-display text-xl font-medium leading-snug">ต้องตามงาน {todo.length} เรื่อง</h2>
          <ul className="mt-2.5 flex flex-col">
            {todo.map((t) => (
              <li key={t.key} className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-line py-3">
                {t.tag}
                <span className="min-w-0 flex-[1_1_320px]">{t.text}</span>
                <Link href={t.href} className={linkButton("secondary")}>
                  {t.link}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-2xl font-semibold leading-snug">สรุปเดือน {label}</h2>
          <span className="text-muted">{isCurrent ? "ตัวเลขด้านล่างนับถึงวันนี้" : "ทั้งเดือน"}</span>
        </div>
        <CycleSelect month={month} months={v.months} />
      </div>

      <div className="flex flex-wrap gap-4">
        {stat("จ่ายออก", formatLiters(v.breakdown.liters), "ลิตร", `${v.breakdown.rows.length} โครงการที่มีการเติม`, `/monthly?month=${month}`)}
        {stat("มูลค่าน้ำมันที่จ่ายออก", formatBaht(v.breakdown.amount), "บาท", `${v.price === null ? "ยังไม่มีราคาน้ำมัน" : `ราคาวันนี้ ${formatBaht(v.price)} บาท/ลิตร`}${v.breakdown.unsignedAmount > 0 ? ` · ในนี้ยังไม่เซ็นรับ ${formatBaht(v.breakdown.unsignedAmount)} บาท` : ""}`, "/invoices")}
        {stat("ใบจ่าย", String(v.breakdown.slips), "ใบ", `วันนี้ ${v.todaySlips} ใบ`, `/issues?from=${monthRange(month).start}&to=${monthRange(month).end}`)}
      </div>

      <Card>
        <h2 className="font-display text-xl font-medium leading-snug">แยกโครงการ เรียงจากที่ใช้มากที่สุด</h2>
        {v.breakdown.rows.length === 0 ? (
          <p className="py-8 text-center text-muted">ยังไม่มีการจ่ายน้ำมันในเดือนนี้</p>
        ) : (
          <>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="t">
              <thead>
                <tr>
                  <th>โครงการ</th>
                  <th className="n">ใบจ่าย</th>
                  <th className="n">ลิตร</th>
                  <th>เทียบกับโครงการที่ใช้มากที่สุด</th>
                  <th className="n">ยอดเงิน (บาท)</th>
                  <th>
                    <span className="sr-only">ดูรายวัน</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {v.breakdown.rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <span className="inline-block whitespace-nowrap rounded-lg bg-idle-soft px-2.5 py-0.5 font-display text-sm font-medium text-earth">{r.label}</span>
                    </td>
                    <td className="n">{r.slips}</td>
                    <td className="n font-semibold">{formatLiters(r.liters)}</td>
                    <td className="min-w-[200px]">
                      <div aria-hidden className="mt-1.5 h-2.5 rounded-[5px] bg-page">
                        <div className="h-2.5 rounded-[5px] bg-earth" style={{ width: `${r.pct}%` }} />
                      </div>
                    </td>
                    <td className="n">{formatBaht(r.amount)}</td>
                    <td className="n">
                      <Link href={`/monthly?month=${month}&project=${r.key}`} className="text-earth underline hover:text-ink">
                        ดูรายวัน
                      </Link>
                    </td>
                  </tr>
                ))}
                {v.idleProjects > 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted">
                      อีก {v.idleProjects} โครงการยังไม่มีการเติมในเดือนนี้{" "}
                      <Link href={`/monthly?month=${month}`} className="text-earth underline">
                        ดูทุกโครงการ
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>รวม</td>
                  <td className="n">{v.breakdown.slips}</td>
                  <td className="n">{formatLiters(v.breakdown.liters)}</td>
                  <td />
                  <td className="n">{formatBaht(v.breakdown.amount)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {/* phone / narrow window: one row per project instead of a table that scrolls sideways */}
          <ul className="mt-3 divide-y divide-line md:hidden">
            {v.breakdown.rows.map((r) => (
              <li key={r.key}>
                <Link href={`/monthly?month=${month}&project=${r.key}`} className="block py-3 text-ink no-underline">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-block whitespace-nowrap rounded-lg bg-idle-soft px-2.5 py-0.5 font-display text-sm font-medium text-earth">{r.label}</span>
                    <span className="font-semibold tabular-nums">{formatBaht(r.amount)} บาท</span>
                  </div>
                  <div aria-hidden className="mt-2 h-2 rounded-[4px] bg-page">
                    <div className="h-2 rounded-[4px] bg-earth" style={{ width: `${r.pct}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3 text-sm text-muted">
                    <span>
                      {formatLiters(r.liters)} ลิตร · {r.slips} ใบ
                    </span>
                    <span className="text-earth underline">ดูรายวัน</span>
                  </div>
                </Link>
              </li>
            ))}
            <li className="flex items-center justify-between border-t-2 border-ink py-3 font-semibold">
              <span>รวม</span>
              <span className="tabular-nums">
                {formatLiters(v.breakdown.liters)} ลิตร · {formatBaht(v.breakdown.amount)} บาท
              </span>
            </li>
          </ul>
          {v.idleProjects > 0 && (
            <p className="mt-2 text-muted md:hidden">
              อีก {v.idleProjects} โครงการยังไม่มีการเติมในเดือนนี้{" "}
              <Link href={`/monthly?month=${month}`} className="text-earth underline">
                ดูทุกโครงการ
              </Link>
            </p>
          )}
          </>
        )}
      </Card>
    </>
  );
}
