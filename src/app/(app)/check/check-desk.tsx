"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Toast } from "@/components/toast";
import { Button, Card, Kbd, Pill, ProjectChip, fieldClass, type Tone } from "@/components/ui";
import { flagLabel } from "@/domain/bookcare-flags";
import { hasAtMostTwoDecimals } from "@/domain/money";
import { thaiShort } from "@/domain/thai-date";
import { formatLiters } from "@/lib/format";
import type { PendingCheck } from "@/server/issues/review-service";
import { acceptMachineAction, correctAndCheckAction, markCheckedAction, mergeMachineAction } from "../issues/review-actions";

type Line = { lineId: string; position: number; machineId: string; machine: string; machinePending: boolean; liters: number; hasPhoto: boolean; photoTakenAt: string | null };

const bkk = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
/** "20/11/69 15:22" */
const stamp = (iso: string | null) => (iso ? `${thaiShort(bkk(iso))} ${hhmm(iso)}` : "-");
/** sent on a later day than it was keyed at the site */
const sentLate = (s: PendingCheck) => !!s.recordedAt && !!s.receivedAt && bkk(s.receivedAt) > bkk(s.recordedAt);

/** short tags for the waiting list: brown = worth knowing, red = something the system caught */
function tags(s: PendingCheck): { tone: Tone; text: string }[] {
  const out: { tone: Tone; text: string }[] = [];
  if (sentLate(s)) out.push({ tone: "wait", text: "ส่งช้า" });
  if (!s.signed) out.push({ tone: "wait", text: "ยังไม่เซ็นรับ" });
  const codes = [...s.flags, ...s.confirmedWarnings].map((c) => c.split(":")[0]);
  if (codes.includes("high_liters")) out.push({ tone: "bad", text: "ลิตรสูงกว่าปกติ" });
  if (codes.includes("new_machine")) out.push({ tone: "bad", text: "เครื่องใหม่" });
  if (codes.includes("over_tank") || codes.includes("over_balance")) out.push({ tone: "bad", text: "เกินน้ำมันในรถ" });
  if (codes.includes("duplicate_machine")) out.push({ tone: "bad", text: "เครื่องซ้ำในใบ" });
  if (codes.includes("late")) out.push({ tone: "bad", text: "รอบเดิมปิดแล้ว" });
  if (codes.includes("dated_ahead")) out.push({ tone: "bad", text: "ลงวันที่ล่วงหน้า" });
  return out;
}

export function CheckDesk({
  list,
  at,
  checkedToday,
  review,
}: {
  list: PendingCheck[];
  at: number;
  checkedToday: number;
  review: { lines: Line[]; knownMachines: { id: string; code: string }[]; driverName: string | null; unsignedReason: string | null };
}) {
  const router = useRouter();
  const cur = list[at];
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [liters, setLiters] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [into, setInto] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<Line | null>(null);
  const [done, setDone] = useState<{ text: string; n: number } | null>(null);
  const held = review.lines.filter((l) => l.machinePending);
  const total = review.lines.reduce((a, l) => a + l.liters, 0);
  const next = list[at + 1] ?? list[at - 1] ?? null;
  const go = (id: string | null) => router.push(id ? `/check?id=${id}` : "/check");

  // a new slip on the right: start fresh
  const shown = useRef(cur.id);
  useEffect(() => {
    if (shown.current === cur.id) return;
    shown.current = cur.id;
    setEditing(false);
    setLiters({});
    setReason("");
    setMsg(null);
  }, [cur.id]);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, then: () => void, text?: string) {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          if (text) setDone((d) => ({ text, n: (d?.n ?? 0) + 1 }));
          then();
          router.refresh();
        } else setMsg(r.message ?? "ทำไม่สำเร็จ");
      } catch {
        setMsg("ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }
  const label = `เล่มที่ ${cur.bookNo} เลขที่ ${cur.docNo}`;
  const check = () => run(() => markCheckedAction(cur.id), () => go(next?.id ?? null), `ตรวจแล้ว ${label}`);
  const startEdit = () => {
    setLiters(Object.fromEntries(review.lines.map((l) => [l.position, String(l.liters)])));
    setEditing(true);
  };
  const saveEdit = () => {
    const bad = review.lines.find((l) => {
      const n = Number((liters[l.position] ?? "").replace(/,/g, ""));
      return !Number.isFinite(n) || n <= 0 || !hasAtMostTwoDecimals(n);
    });
    if (bad) return setMsg(`บรรทัด ${bad.position}: ลิตรต้องมากกว่า 0 และมีทศนิยมได้ไม่เกิน 2 ตำแหน่ง`);
    if (!reason.trim()) return setMsg("ใส่เหตุผลที่แก้ก่อนบันทึก");
    run(
      () => correctAndCheckAction(cur.id, review.lines.map((l) => ({ position: l.position, liters: liters[l.position] })), reason),
      () => go(next?.id ?? null),
      `แก้ลิตรและตรวจแล้ว ${label}`,
    );
  };

  // design: Enter ตรวจแล้ว · E แก้ไข · ↑ ↓ เลือกใบ (not while typing, not inside a window)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || busy || zoom) return;
      if (t.closest("input, textarea, select, dialog, [contenteditable=true]")) return;
      if (editing) return;
      if (e.key === "Enter" && held.length === 0 && t.tagName !== "BUTTON" && t.tagName !== "A") {
        e.preventDefault();
        check();
      } else if (e.key === "e" || e.key === "E" || e.key === "ำ") {
        e.preventDefault();
        startEdit();
      } else if (e.key === "ArrowDown" && list[at + 1]) {
        e.preventDefault();
        go(list[at + 1].id);
      } else if (e.key === "ArrowUp" && list[at - 1]) {
        e.preventDefault();
        go(list[at - 1].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const when = cur.timeIn || cur.timeOut ? `${thaiShort(cur.issueDate)} เวลา ${cur.timeIn ?? "-"}–${cur.timeOut ?? "-"}` : cur.recordedAt ? stamp(cur.recordedAt) : thaiShort(cur.issueDate);
  const flags = [...cur.flags, ...cur.confirmedWarnings];

  return (
    <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-start">
      {done && <Toast key={done.n}>{done.text}</Toast>}
      <Card className="flex min-w-0 flex-col gap-3 p-5 lg:w-[380px] lg:flex-none">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-medium leading-[1.4]">รอตรวจ {list.length} ใบ</h2>
          <span className="text-sm text-muted">เก่าสุดอยู่บน</span>
        </div>
        <ul className="flex flex-col gap-2">
          {list.map((s, i) => (
            <li key={s.id}>
              <Link
                href={`/check?id=${s.id}`}
                aria-current={i === at ? "true" : undefined}
                className={`flex flex-col gap-1.5 rounded-control border px-3.5 py-3 text-ink no-underline ${i === at ? "border-earth bg-idle-soft" : "border-line bg-card hover:bg-page"}`}
              >
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <ProjectChip code={s.projectRef} name={s.projectName} />
                  <span className="text-sm text-muted">{stamp(s.recordedAt ?? s.receivedAt)}</span>
                </span>
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-display text-lg font-medium">{formatLiters(s.liters)} ลิตร</span>
                  <span className="text-sm text-muted">{s.machines} เครื่อง</span>
                </span>
                {tags(s).length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {tags(s).map((t) => (
                      <Pill key={t.text} tone={t.tone}>
                        {t.text}
                      </Pill>
                    ))}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">ตรวจแล้ววันนี้ {checkedToday} ใบ ป้ายสีแดงคือสิ่งที่ระบบจับได้ ควรดูรูปให้ละเอียดขึ้น</p>
      </Card>

      <Card className="flex min-w-0 flex-1 flex-col gap-5 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-medium leading-[1.4]">ใบเลขที่ {cur.docNo}</h2>
          <Link href={`/issues/${cur.id}`} className="text-earth underline hover:text-ink">
            เปิดหน้ารายละเอียดใบ
          </Link>
        </div>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-x-6 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-muted">โครงการ</dt>
            <dd>
              <ProjectChip code={cur.projectRef} name={cur.projectName} />
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-muted">บันทึกที่หน้างาน</dt>
            <dd>{when}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-muted">พขร.เติมน้ำมัน</dt>
            <dd>{review.driverName ?? "-"}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-muted">ส่งถึงระบบ</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {stamp(cur.receivedAt)} {sentLate(cur) && <Pill tone="wait">ส่งช้า</Pill>}
            </dd>
          </div>
        </dl>
        {flags.length > 0 && (
          <ul aria-label="สิ่งที่ระบบจับได้" className="flex flex-col gap-1.5">
            {flags.map((f) => (
              <li key={f}>
                <Pill tone="bad">{flagLabel(f)}</Pill>
              </li>
            ))}
          </ul>
        )}

        <p>เทียบตัวเลขในรูปมิเตอร์กับลิตรที่ พขร. พิมพ์ ทีละเครื่อง</p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {review.lines.map((l) => (
            <li key={l.lineId} className="flex flex-col gap-2.5 rounded-control border border-line p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display font-medium">
                  {l.position}. {l.machine} {l.machinePending && <Pill tone="bad">ชื่อรอตรวจ</Pill>}
                </span>
                {l.hasPhoto && (
                  <Button type="button" className="min-h-11 px-3 text-[15px]" onClick={() => setZoom(l)}>
                    ขยายรูป
                  </Button>
                )}
              </div>
              {l.hasPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/issue-line-photo/${l.lineId}`} alt={`รูปมิเตอร์ บรรทัด ${l.position}`} className="h-52 w-full rounded-control bg-tank object-contain" />
              ) : (
                <p className="flex h-52 items-center justify-center rounded-control bg-page text-sm text-muted">ไม่มีรูปมิเตอร์</p>
              )}
              {editing ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`ck-l${l.position}`} className="text-sm">
                    ลิตรที่ถูกต้อง
                  </label>
                  <input
                    id={`ck-l${l.position}`}
                    inputMode="decimal"
                    value={liters[l.position] ?? ""}
                    onChange={(e) => setLiters({ ...liters, [l.position]: e.target.value })}
                    className={`${fieldClass} text-right tabular-nums`}
                  />
                  <span className="text-sm text-muted">พขร. พิมพ์ {formatLiters(l.liters)} ลิตร</span>
                </div>
              ) : (
                <span>
                  พขร. พิมพ์ <span className="font-display text-xl font-medium">{formatLiters(l.liters)}</span> ลิตร
                </span>
              )}
            </li>
          ))}
        </ul>

        {held.length > 0 && (
          <div className="flex flex-col gap-3 rounded-control border border-repair p-4">
            <h3 className="font-display font-medium">ชื่อเครื่องจักรที่ พขร. พิมพ์เอง ต้องจัดการก่อนกดตรวจแล้ว</h3>
            {held.map((l) => (
              <div key={l.machineId} className="flex flex-wrap items-end gap-3">
                <div className="min-w-40">
                  <div className="text-sm text-muted">ชื่อที่พิมพ์</div>
                  <div className="font-medium">{l.machine}</div>
                </div>
                <div className="flex min-w-48 flex-col gap-1.5">
                  <label htmlFor={`into-${l.machineId}`} className="text-sm">
                    รวมกับเครื่องเดิม
                  </label>
                  <select id={`into-${l.machineId}`} value={into[l.machineId] ?? ""} onChange={(e) => setInto({ ...into, [l.machineId]: e.target.value })} className={fieldClass}>
                    <option value="">เลือกเครื่องเดิม…</option>
                    {review.knownMachines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" disabled={busy || !into[l.machineId]} onClick={() => run(() => mergeMachineAction(cur.id, l.machineId, into[l.machineId]), () => {})}>
                  รวมกับเครื่องเดิม
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => run(() => acceptMachineAction(cur.id, l.machineId), () => {})}>
                  รับเป็นเครื่องใหม่
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {cur.signed ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/issue-photo/${cur.id}`} alt="ลายเซ็นของผู้รับ" className="h-14 w-32 rounded-control border border-line bg-card object-contain" />
                <span className="text-sm">
                  <span className="text-muted">ผู้เซ็นรับ เซ็นบนมือถือของ พขร.</span> {cur.receiverName ?? "-"}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted">ยังไม่เซ็นรับ{review.unsignedReason ? `: ${review.unsignedReason}` : ""}</span>
            )}
          </div>
          <span className="font-display">
            รวม {review.lines.length} เครื่อง {formatLiters(total)} ลิตร
          </span>
        </div>

        {editing && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ck-why" className="text-sm">
              เหตุผลที่แก้
            </label>
            <textarea
              id="ck-why"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น รูปมิเตอร์อ่านได้ 24.0 แต่ พขร. พิมพ์ 42"
              className={`${fieldClass} h-auto min-h-[72px] resize-y py-2.5`}
            />
            <span className="text-[13px] text-muted">
              ต้องใส่เหตุผลก่อนบันทึก{cur.signed ? " ใบนี้เซ็นรับแล้ว เมื่อแก้จะติดป้าย แก้หลังเซ็นรับ" : ""} และเก็บค่าเดิมไว้ในประวัติของใบ
            </span>
          </div>
        )}
        {msg && (
          <p role="alert" className="text-sm text-repair">
            {msg}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!editing ? (
            <span className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted md:flex">
              <span>
                <Kbd>Enter</Kbd> ตรวจแล้ว
              </span>
              <span>
                <Kbd>E</Kbd> แก้ไข
              </span>
              <span>
                <Kbd>↑ ↓</Kbd> เลือกใบ
              </span>
            </span>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-3">
            {editing ? (
              <>
                <Button type="button" disabled={busy} onClick={() => (setEditing(false), setMsg(null))}>
                  ยกเลิกการแก้
                </Button>
                <Button type="button" variant="primary" disabled={busy || held.length > 0} onClick={saveEdit}>
                  บันทึกการแก้ และตรวจแล้ว
                </Button>
              </>
            ) : (
              <>
                <Button type="button" disabled={busy} onClick={startEdit}>
                  แก้ไข
                </Button>
                <Button type="button" variant="primary" disabled={busy || held.length > 0} onClick={check}>
                  ตรวจแล้ว ไปใบถัดไป
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog wide open={!!zoom} title={zoom ? `รูปมิเตอร์ บรรทัด ${zoom.position} ${zoom.machine}` : ""} onClose={() => setZoom(null)}>
        {zoom && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/issue-line-photo/${zoom.lineId}`} alt={`รูปมิเตอร์ บรรทัด ${zoom.position} ขยาย`} className="max-h-[70vh] w-full rounded-control bg-tank object-contain" />
        )}
        <div className="flex justify-end">
          <Button type="button" onClick={() => setZoom(null)}>
            ปิด
          </Button>
        </div>
      </ConfirmDialog>
    </div>
  );
}
