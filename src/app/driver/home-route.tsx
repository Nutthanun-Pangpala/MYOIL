"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TruckIcon } from "@/components/driver/truck-art";
import { bangkok, totalLiters, siteName } from "@/domain/driver-fill";
import { flush } from "@/lib/driver/outbox";
import { useLocal, type LocalState, type OutItem } from "@/lib/driver/store";

export type HomeStop = { id: string; position: number; code: string; name: string; /** where the site is */ detail: string | null; note: string | null; status: "pending" | "filled" | "skipped"; issueId: string | null; skipReason: string | null; liters: number | null };

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const dock = "flex min-h-[62px] w-full items-center justify-center gap-[10px] rounded-[16px] border px-[16px] text-center font-display text-[20px] font-medium no-underline";
const yellow = `${dock} border-safety-line bg-safety text-ink shadow-[0_4px_0_var(--color-safety-deep)]`;
const rail = "w-[4px] min-h-[8px] flex-1 my-[2px] bg-[repeating-linear-gradient(180deg,var(--color-idle)_0,var(--color-idle)_7px,transparent_7px,transparent_13px)]";
const pill = "inline-flex items-center gap-[6px] whitespace-nowrap rounded-full py-[3px] pl-[10px] pr-[12px] text-[14px] font-medium";

/** what the phone itself knows about a stop: a slip waiting to be sent, or one still being filled */
function localOf(st: HomeStop, local: LocalState) {
  if (st.status === "filled") return {};
  const out = local.outbox.find((o) => o.kind === "issue" && o.stopId === st.id);
  if (out) return { out };
  const draft = local.drafts.find((d) => d.stopId === st.id);
  return draft ? { draft } : {};
}

function plan(stops: HomeStop[], local: LocalState) {
  const rows = stops.map((st) => ({ st, ...localOf(st, local) }));
  const resume = rows.find((r) => r.draft);
  const next = rows.find((r) => r.st.status === "pending" && !r.out && !r.draft);
  return { rows, resume, next };
}

/** send what waits when the home opens and when the signal comes back; then show the server's news */
function useAutoSend() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const send = async (retryFailed: boolean) => {
    setSending(true);
    await flush(retryFailed).catch(() => undefined);
    setSending(false);
    router.refresh();
  };
  useEffect(() => {
    void flush().then(() => router.refresh());
    const on = () => void flush().then(() => router.refresh());
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [router]);
  return { sending, send };
}

/** design boards HomeOffline / HomeFailed: slips that have not reached MYOIL yet */
export function HomeBanner() {
  const local = useLocal();
  const { sending, send } = useAutoSend();
  const failed = local.outbox.filter((o) => o.state === "failed");
  const waiting = local.outbox.filter((o) => o.state === "waiting");
  if (!local.outbox.length) return null;
  const names = (items: OutItem[]) => items.map((o) => (o.kind === "issue" ? `ใบของ ${o.label}` : `เติมเข้ารถ ${fmt(o.liters)} ลิตร`)).join(", ");
  return (
    <div className="flex flex-col gap-[8px]">
      {failed.length > 0 && (
        <div role="alert" className="rounded-[16px] border border-repair-line bg-repair-soft px-[14px] py-[10px] text-repair-ink">
          <b>ส่งไม่สำเร็จ {failed.length} รายการ</b>
          <br />
          {names(failed)} ยังอยู่ในเครื่อง ไม่หาย
          {failed.map((o) => o.error && <span key={o.ref} className="block text-[14px]">{o.label}: {o.error}</span>)}
          <span className="block text-[14px]">ถ้าลองส่งแล้วยังไม่ได้ แจ้งแอดมินสโตร์กลาง</span>
        </div>
      )}
      {waiting.length > 0 && (
        <div role="status" className="rounded-[16px] border border-safety-line bg-safety-soft px-[14px] py-[10px]">
          <b>ยังไม่ได้ส่ง รอส่ง {waiting.length} รายการ</b>
          <br />
          {names(waiting)} บันทึกต่อได้ตามปกติ จะส่งเองเมื่อมีสัญญาณ
        </div>
      )}
      <button type="button" disabled={sending} onClick={() => send(true)} className="min-h-[56px] rounded-[14px] border-2 border-earth bg-card font-display text-[17px] font-medium disabled:opacity-50">
        {sending ? "กำลังส่ง" : "ลองส่งอีกครั้ง"}
      </button>
    </div>
  );
}

export function HomeDock({ stops }: { stops: HomeStop[] }) {
  const { resume, next } = plan(stops, useLocal());
  if (resume)
    return (
      <Link href={`/driver/stop/${resume.st.id}`} className={yellow}>
        ทำต่อที่ {resume.st.code}
      </Link>
    );
  if (next)
    return (
      <Link href={`/driver/stop/${next.st.id}`} className={yellow}>
        เริ่มเติมที่จุดถัดไป
      </Link>
    );
  return (
    <span aria-disabled="true" className={`${dock} border-line bg-line text-gray-ink`}>
      ครบทุกจุดในเส้นทางแล้ว
    </span>
  );
}

const Chevron = ({ strong }: { strong?: boolean }) => (
  <svg aria-hidden="true" width={strong ? 24 : 22} height={strong ? 24 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${strong ? "text-earth" : "text-muted"}`}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

/** design board Main (and HomeResume / HomeOffline / HomeFailed rows): the day's stops as a timeline */
export function HomeRoute({ stops }: { stops: HomeStop[] }) {
  const { rows, resume, next } = plan(stops, useLocal());
  return (
    <ol className="flex flex-col">
      {rows.map(({ st, out, draft }, i) => {
        const isNext = !resume && st.id === next?.st.id;
        const strong = isNext || !!draft;
        const done = st.status === "filled";
        const liters = done ? st.liters : out ? out.liters : draft ? totalLiters(draft.lines) : null;
        return (
          <li key={st.id} className="flex items-stretch gap-[10px]" aria-current={strong ? "step" : undefined}>
            <div className={`flex w-[44px] shrink-0 flex-col items-center ${strong ? "pt-[6px]" : "pt-[10px]"}`}>
              {done || out ? (
                <span className={`flex size-[36px] items-center justify-center rounded-full ${done ? "bg-working" : out!.state === "failed" ? "bg-repair" : "bg-idle"}`}>
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    {out?.state === "failed" ? <path d="M12 6v7M12 17.5v.5" /> : <path d="M5 12.5l4.5 4.5L19 7.5" />}
                  </svg>
                </span>
              ) : strong ? (
                <span className="flex size-[44px] items-center justify-center rounded-full border-[3px] border-earth bg-safety">
                  <TruckIcon />
                </span>
              ) : (
                <span className={`flex size-[36px] items-center justify-center rounded-full border-2 font-display text-[17px] font-medium ${st.status === "skipped" ? "border-line bg-page text-muted" : "border-idle bg-card"}`}>{st.position}</span>
              )}
              {i < rows.length - 1 && <span aria-hidden="true" className={rail} />}
            </div>
            <Link
              href={done && st.issueId ? `/driver/slip/${st.issueId}` : `/driver/stop/${st.id}`}
              title={st.name}
              className={`mb-[8px] flex min-w-0 flex-1 items-center gap-[10px] rounded-[16px] bg-card py-[6px] pl-[14px] pr-[12px] text-ink no-underline ${strong ? "min-h-[68px] border-2 border-earth shadow-[0_3px_0_var(--color-earth)]" : "min-h-[56px] border border-line shadow-[0_2px_0_var(--color-line)]"}`}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                {/* OBS-23: the site's name, big; its short code beside it, smaller; where it is, under it */}
                <span className={`break-words font-display font-semibold leading-[1.25] ${strong ? "text-[22px]" : "text-[19px]"} ${st.status === "skipped" && !out && !draft ? "text-muted" : ""}`}>
                  {siteName(st.name, st.code)}
                  {siteName(st.name, st.code) !== st.code && <span className="ml-[8px] whitespace-nowrap rounded-[8px] bg-page px-[7px] py-[1px] align-middle text-[14px] font-medium text-earth">{st.code}</span>}
                </span>
                {st.detail && <span className="text-[14px] leading-[1.35] text-muted">{st.detail}</span>}
                {draft ? (
                  <span className="text-[14px] leading-[1.35] text-muted">
                    กำลังเติม {draft.lines.length} เครื่อง เริ่ม {bangkok(new Date(draft.startedAt)).time}
                  </span>
                ) : isNext ? (
                  <span className="text-[14px] leading-[1.35] text-muted">จุดถัดไป</span>
                ) : null}
                {st.note && st.status === "pending" && !out && <span className="text-[14px] leading-[1.35] text-muted">{st.note}</span>}
                {st.status === "skipped" && !out && !draft && st.skipReason && <span className="text-[14px] leading-[1.35] text-muted">{st.skipReason}</span>}
              </span>
              {liters != null && liters > 0 && (
                <span className="whitespace-nowrap font-display text-[17px] font-medium">
                  {fmt(liters)} <span className="text-[14px] font-normal">ลิตร</span>
                </span>
              )}
              {done ? (
                <span className={`${pill} bg-working-soft text-working-ink`}>
                  <span aria-hidden="true" className="size-[8px] rounded-full bg-working" />
                  ส่งแล้ว
                </span>
              ) : out ? (
                <span className={`${pill} ${out.state === "failed" ? "bg-repair-soft text-repair-ink" : "bg-idle-soft text-earth"}`}>{out.state === "failed" ? "ส่งไม่สำเร็จ" : "รอส่ง"}</span>
              ) : st.status === "skipped" && !draft ? (
                <span className={`${pill} bg-idle-soft pl-[12px] text-earth`}>ข้าม</span>
              ) : (
                <Chevron strong={strong} />
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
