import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Button, Card, Pill, linkButton } from "@/components/ui";
import { isRealDate } from "@/domain/bookcare-api";
import { addDays } from "@/domain/iso-date";
import { thaiLong } from "@/domain/thai-date";
import { canChangeStop } from "@/domain/route";
import { canOpen } from "@/lib/nav";
import { canWriteFuel } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { routeForDate } from "@/server/routes/route-service";
import { addStopAction, copyAction, moveAction, noteAction, removeAction } from "./actions";

export const metadata = { title: "เส้นทางรถเติมน้ำมัน" };

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const time = (d: Date) => d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });

// วางเส้นทางรถเติมน้ำมัน (brief §8, R20–R23): the admin plans the day; the driver's phone (BookCare) fills or skips each stop
export default async function RoutesPage({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  if (!canOpen(session.role, "/routes")) redirect("/");
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const date = isRealDate(one(sp.date)) ? one(sp.date) : today;
  const writer = canWriteFuel(session);
  const [route, projectList] = await Promise.all([
    routeForDate(date),
    db.select({ id: schema.projects.id, refCode: schema.projects.refCode, name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.isActive, true)).orderBy(asc(schema.projects.refCode)),
  ]);
  const stops = route?.stops ?? [];
  const msg = one(sp.msg);
  const err = one(sp.err);
  const counts = { pending: stops.filter((s) => s.status === "pending").length, filled: stops.filter((s) => s.status === "filled").length, skipped: stops.filter((s) => s.status === "skipped").length };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-semibold leading-snug">เส้นทางรถเติมน้ำมัน</h1>
          <p className="text-muted">วางจุดเติมของแต่ละวันตามลำดับ พขร. เริ่มเติมได้เฉพาะจุดในเส้นทาง เลือกโครงการเองไม่ได้</p>
        </div>
        <form className="flex flex-wrap items-end gap-2" action="/routes">
          <Link href={`/routes?date=${addDays(date, -1)}`} className={linkButton()} aria-label="วันก่อนหน้า">
            ‹
          </Link>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-muted">วันที่</span>
            <input type="date" name="date" defaultValue={date} className="min-h-11 rounded-control border border-idle bg-card px-3" />
          </label>
          <Link href={`/routes?date=${addDays(date, 1)}`} className={linkButton()} aria-label="วันถัดไป">
            ›
          </Link>
          <Button type="submit">ดู</Button>
        </form>
      </header>

      {msg && (
        <p role="status" className="rounded-control bg-working-soft px-4 py-2 font-semibold text-working">
          {msg}
        </p>
      )}
      {err && (
        <p role="alert" className="rounded-control bg-repair-soft px-4 py-2 font-semibold text-repair">
          {err}
        </p>
      )}

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[22px] font-semibold">{thaiLong(date)}</h2>
          {stops.length > 0 && (
            <span className="text-muted" data-testid="route-counts">
              {stops.length} จุด · ยังไม่ไป {counts.pending} · เติมแล้ว {counts.filled} · ข้าม {counts.skipped}
            </span>
          )}
        </div>

        {stops.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted">ยังไม่มีเส้นทางของวันนี้ มือถือของ พขร. จะขึ้นว่าให้ติดต่อแอดมิน และเริ่มเติมไม่ได้</p>
            {writer && (
              <form action={copyAction}>
                <input type="hidden" name="date" value={date} />
                <Button type="submit">คัดลอกจากวันก่อน</Button>
              </form>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="t w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className="w-[56px]">ลำดับ</th>
                  <th>โครงการ</th>
                  <th>หมายเหตุถึง พขร.</th>
                  <th>สถานะ</th>
                  {writer && <th className="w-[200px]" />}
                </tr>
              </thead>
              <tbody>
                {stops.map((s, i) => {
                  const open = canChangeStop(s.status);
                  return (
                    <tr key={s.id} data-testid="route-stop">
                      <td className="font-display text-[18px] font-semibold">{s.position}</td>
                      <td>
                        <div className="font-display font-semibold">{s.projectRefCode}</div>
                        <div className="text-[13px] text-muted">{s.projectName}</div>
                      </td>
                      <td>
                        {writer && open ? (
                          <form action={noteAction} className="flex gap-2">
                            <input type="hidden" name="date" value={date} />
                            <input type="hidden" name="stopId" value={s.id} />
                            <input name="note" defaultValue={s.note ?? ""} aria-label={`หมายเหตุจุดที่ ${s.position}`} className="min-h-10 w-full rounded-control border border-idle bg-card px-2" />
                            <Button type="submit" variant="ghost">
                              บันทึก
                            </Button>
                          </form>
                        ) : (
                          (s.note ?? "–")
                        )}
                      </td>
                      <td>
                        {s.status === "filled" ? (
                          <span className="flex flex-col gap-1">
                            <Pill tone="ok">เติมแล้ว</Pill>
                            {s.issueId && (
                              <Link href={`/issues/${s.issueId}`} className="text-[13px] font-semibold text-earth underline">
                                ใบ {s.issueNo ?? ""}
                              </Link>
                            )}
                          </span>
                        ) : s.status === "skipped" ? (
                          <span className="flex flex-col gap-1">
                            <Pill tone="wait">ข้าม</Pill>
                            <span className="text-[13px]">
                              {s.skipReason}
                              {s.skippedAt ? ` · ${time(s.skippedAt)}` : ""}
                              {s.skippedBy ? ` · ${s.skippedBy}` : ""}
                            </span>
                          </span>
                        ) : (
                          <Pill tone="bad">ยังไม่ไป</Pill>
                        )}
                      </td>
                      {writer && (
                        <td>
                          {open ? (
                            <div className="flex gap-1">
                              <form action={moveAction}>
                                <input type="hidden" name="date" value={date} />
                                <input type="hidden" name="stopId" value={s.id} />
                                <input type="hidden" name="dir" value="up" />
                                <Button type="submit" variant="ghost" disabled={i === 0} aria-label={`เลื่อนจุดที่ ${s.position} ขึ้น`}>
                                  ↑
                                </Button>
                              </form>
                              <form action={moveAction}>
                                <input type="hidden" name="date" value={date} />
                                <input type="hidden" name="stopId" value={s.id} />
                                <input type="hidden" name="dir" value="down" />
                                <Button type="submit" variant="ghost" disabled={i === stops.length - 1} aria-label={`เลื่อนจุดที่ ${s.position} ลง`}>
                                  ↓
                                </Button>
                              </form>
                              <form action={removeAction}>
                                <input type="hidden" name="date" value={date} />
                                <input type="hidden" name="stopId" value={s.id} />
                                <Button type="submit" variant="ghost" className="text-repair" aria-label={`ลบจุดที่ ${s.position}`}>
                                  ลบ
                                </Button>
                              </form>
                            </div>
                          ) : (
                            <span className="text-[13px] text-muted">เติมแล้ว แก้ไม่ได้</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {writer && (
          <form action={addStopAction} className="flex flex-wrap items-end gap-3 border-t border-line pt-4" aria-label="เพิ่มจุดเติม">
            <input type="hidden" name="date" value={date} />
            <label className="flex min-w-[260px] flex-1 flex-col gap-1">
              <span className="text-[13px] text-muted">โครงการ</span>
              <select name="projectId" required defaultValue="" className="min-h-11 rounded-control border border-idle bg-card px-3">
                <option value="" disabled>
                  เลือกโครงการ
                </option>
                {projectList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.refCode} · {p.name.replace(/^โครงการ\s*/, "").slice(0, 70)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[220px] flex-1 flex-col gap-1">
              <span className="text-[13px] text-muted">หมายเหตุถึง พขร. (ไม่บังคับ)</span>
              <input name="note" className="min-h-11 rounded-control border border-idle bg-card px-3" />
            </label>
            <Button type="submit" variant="primary">
              เพิ่มจุดเติม
            </Button>
          </form>
        )}
      </Card>
      <p className="text-[13px] text-muted">สถานะมาจากมือถือของ พขร. ผ่าน BookCare: เติมแล้ว = มีใบจ่ายของจุดนั้น · ข้าม = พขร. กดข้ามพร้อมเหตุผล จุดที่เพิ่มระหว่างวันจะขึ้นที่มือถือเมื่อมีสัญญาณ</p>
    </>
  );
}
