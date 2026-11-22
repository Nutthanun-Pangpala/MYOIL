"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button, Card, linkButton } from "@/components/ui";
import { checkIssue, nextDocNo, type IssueCheck, type IssueInput } from "@/domain/issue-check";
import { hasAtMostTwoDecimals, lineAmount, sumAmounts, sumLiters } from "@/domain/money";
import { thaiShort } from "@/domain/thai-date";
import { formatBaht, formatLiters } from "@/lib/format";
import { previewIssueAction, saveIssueAction, updateIssueAction } from "../actions";

type Project = { id: string; refCode: string; name: string };
type LineState = { machine: string; hourMeter: string; liters: string };

const emptyLine = (): LineState => ({ machine: "", hourMeter: "", liters: "" });
const toNum = (s: string): number | null => {
  const t = s.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const projectLabel = (p: Project) => `${p.refCode} — ${p.name}`;

export function IssueForm({
  projects,
  machines,
  initial,
  justSaved,
  edit,
}: {
  projects: Project[];
  machines: string[];
  initial: { issueDate: string; bookNo: string; docNo: string };
  justSaved: boolean;
  /** editing a saved slip: its id, the values it holds now, and the project as the box shows it */
  edit?: { id: string; input: IssueInput; projectText: string };
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();

  const [bookNo, setBookNo] = useState(edit?.input.bookNo ?? initial.bookNo);
  const [docNo, setDocNo] = useState(edit?.input.docNo ?? initial.docNo);
  const [issueDate, setIssueDate] = useState(edit?.input.issueDate ?? initial.issueDate);
  const [projectText, setProjectText] = useState(edit?.projectText ?? "");
  const [timeIn, setTimeIn] = useState(edit?.input.timeIn ?? "");
  const [timeOut, setTimeOut] = useState(edit?.input.timeOut ?? "");
  const [fuelDriver, setFuelDriver] = useState(edit?.input.fuelDriver ?? "");
  const [machineDriver, setMachineDriver] = useState(edit?.input.machineDriver ?? "");
  const [lines, setLines] = useState<LineState[]>(
    edit ? edit.input.lines.map((l) => ({ machine: l.machine, hourMeter: l.hourMeter === null ? "" : String(l.hourMeter), liters: l.liters === null ? "" : String(l.liters) })) : [emptyLine()],
  );
  const [receivedSigned, setReceivedSigned] = useState(edit?.input.receivedSigned ?? false);
  const [receiverName, setReceiverName] = useState(edit?.input.receiverName ?? "");

  // typed text → project: exact "REF — name" from the list, or just the ref code
  const projectId = useMemo(() => {
    const t = projectText.trim().toLowerCase();
    if (!t) return null;
    return projects.find((p) => projectLabel(p).toLowerCase() === t || p.refCode.toLowerCase() === t)?.id ?? null;
  }, [projectText, projects]);

  const input: IssueInput = useMemo(
    () => ({
      bookNo,
      docNo,
      issueDate,
      projectId,
      timeIn,
      timeOut,
      fuelDriver,
      machineDriver,
      lines: lines.map((l) => ({ machine: l.machine, hourMeter: toNum(l.hourMeter), liters: toNum(l.liters) })),
      receivedSigned,
      receiverName,
    }),
    [bookNo, docNo, issueDate, projectId, timeIn, timeOut, fuelDriver, machineDriver, lines, receivedSigned, receiverName],
  );

  // ── live checks from the server (duplicates, closed cycle, history) merged over the instant local rules ──
  // `input` = what the answer was asked about: an answer for older input is never shown or used (BUG-04)
  const [server, setServer] = useState<{ check: IssueCheck; price: number | null; duplicateIssueId: string | null; input: IssueInput } | null>(null);
  const local = useMemo(
    () => checkIssue(input, { duplicateIssueId: null, closedCycleLabel: null, history: {} }),
    [input],
  );
  useEffect(() => {
    const t = setTimeout(() => {
      previewIssueAction(input, edit?.id)
        .then((r) => setServer({ ...r, input }))
        .catch(() => setServer(null)); // offline / signed out: the save will say so
    }, 350);
    return () => clearTimeout(t);
  }, [input]);
  const fresh = server && server.input === input ? server : null;
  const check = fresh?.check ?? local;
  const price = server?.price ?? null;

  // errors for empty required fields appear once the person has touched the form or pressed save
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  const showErr = (k: string, msg: string | undefined) => (msg && (attempted || touched[k]) ? msg : undefined);

  // ── lines ──
  const focusAfterRender = useRef<{ line: number; field: string } | null>(null);
  useEffect(() => {
    const f = focusAfterRender.current;
    if (!f) return;
    focusAfterRender.current = null;
    document.querySelector<HTMLInputElement>(`[data-line="${f.line}"][data-f="${f.field}"]`)?.focus();
  }, [lines.length]);

  const setLine = (i: number, patch: Partial<LineState>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = () => {
    focusAfterRender.current = { line: lines.length, field: "machine" };
    setLines((ls) => [...ls, emptyLine()]);
  };
  const removeLine = (i: number) => setLines((ls) => (ls.length === 1 ? [emptyLine()] : ls.filter((_, j) => j !== i)));

  // ── totals ──
  const litersOf = lines.map((l) => toNum(l.liters)).filter((n): n is number => n !== null && n > 0);
  // OBS-19: a liters value with a 3rd decimal is refused, so never show totals computed from it
  const badLiters = litersOf.some((l) => !hasAtMostTwoDecimals(l));
  const totalLiters = sumLiters(litersOf);
  const totalAmount = price === null || badLiters ? null : sumAmounts(litersOf.map((l) => lineAmount(l, price)));

  // ── save ──
  const [saveError, setSaveError] = useState<string | null>(null);
  function save(mode: "done" | "next") {
    setAttempted(true);
    setSaveError(null);
    // the instant rules decide whether to send; the server re-checks everything and answers with its own errors
    if (!local.ok) return;
    startSaving(async () => {
      try {
        if (edit) {
          const r = await updateIssueAction(edit.id, input);
          if (r.ok) router.push(`/issues/${edit.id}?saved=1`);
          else if (r.check) setServer({ check: r.check, price, duplicateIssueId: null, input });
          else setSaveError(r.message);
          return;
        }
        const res = await saveIssueAction(input);
        if (res.ok) {
          if (mode === "next") {
            const q = new URLSearchParams({ saved: "1", date: issueDate, book: bookNo.trim(), doc: nextDocNo(docNo) });
            // full reload of the page state: an empty form, same date, next number
            window.location.assign(`/issues/new?${q}`);
          } else {
            router.push(`/issues/${res.id}?saved=1`);
          }
        } else {
          setServer({ check: res.check, price, duplicateIssueId: null, input });
        }
      } catch {
        setSaveError("บันทึกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  const field = "h-11 w-full rounded-control border border-line bg-card px-3 text-[15px]";
  const bad = "border-repair";
  const Err = ({ msg }: { msg?: string }) =>
    msg ? (
      <p role="alert" className="mt-1 text-[13px] text-repair">
        บันทึกไม่ได้: {msg}
      </p>
    ) : null;

  return (
    <form
      className="flex max-w-5xl flex-col gap-5"
      onSubmit={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        const el = e.target as HTMLElement;
        if (e.key === "Enter" && e.ctrlKey) {
          e.preventDefault();
          save("done");
        } else if (e.key === "Enter" && el.tagName === "INPUT" && el.getAttribute("type") !== "checkbox") {
          e.preventDefault(); // Enter never submits by accident; on the last liters box it adds a line
          if (el.getAttribute("data-f") === "liters" && Number(el.getAttribute("data-line")) === lines.length - 1) addLine();
        }
      }}
    >
      <Link href="/issues" className="text-[14px] text-earth underline">
        กลับไปรายการใบจ่าย
      </Link>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl text-earth">{edit ? "แก้ไขใบจ่าย" : "บันทึกใบจ่าย"}</h1>
        <p className="text-[13px] text-muted">ใบเบิกน้ำมันเชื้อเพลิง · ช่องเรียงตามใบกระดาษจากบนลงล่าง</p>
      </div>
      {justSaved && (
        <p role="status" className="rounded-control bg-working-soft px-3 py-2 text-[14px] text-working">
          บันทึกแล้ว — เปิดฟอร์มเปล่าให้คีย์ใบถัดไป
        </p>
      )}

      <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[14px]">
          เล่มที่
          <input
            className={`${field} ${showErr("book", check.errors.book) ? bad : ""}`}
            value={bookNo}
            onChange={(e) => setBookNo(e.target.value)}
            onBlur={() => touch("book")}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoFocus={!edit && !initial.bookNo}
          />
          <Err msg={showErr("book", check.errors.book)} />
        </label>
        <label className="text-[14px]">
          เลขที่
          <input
            className={`${field} ${showErr("doc", check.errors.doc) ? bad : ""}`}
            value={docNo}
            onChange={(e) => setDocNo(e.target.value)}
            onBlur={() => touch("doc")}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoFocus={!edit && !!initial.bookNo}
          />
          <Err msg={showErr("doc", check.errors.doc)} />
          {server?.duplicateIssueId && (
            <Link href={`/issues/${server.duplicateIssueId}`} className="text-[13px] text-earth underline" target="_blank">
              เปิดดูใบเดิม
            </Link>
          )}
        </label>
        <label className="text-[14px]">
          วันที่ {issueDate && <span className="text-muted">({thaiShort(issueDate)})</span>}
          <input
            type="date"
            className={`${field} ${showErr("date", check.errors.date) ? bad : ""}`}
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            onBlur={() => touch("date")}
          />
          <Err msg={showErr("date", check.errors.date)} />
        </label>
        <label className="text-[14px]">
          โครงการ
          <input
            className={`${field} ${showErr("project", check.errors.project) ? bad : ""}`}
            list="project-list"
            value={projectText}
            onChange={(e) => setProjectText(e.target.value)}
            onBlur={() => touch("project")}
            placeholder="พิมพ์รหัสหรือชื่อ"
          />
          <datalist id="project-list">
            {projects.map((p) => (
              <option key={p.id} value={projectLabel(p)} />
            ))}
          </datalist>
          <Err msg={showErr("project", check.errors.project)} />
        </label>
        <label className="text-[14px]">
          เวลาเข้า <span className="text-muted">(ไม่บังคับ)</span>
          <input type="time" className={field} value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
        </label>
        <label className="text-[14px]">
          เวลาออก <span className="text-muted">(ไม่บังคับ)</span>
          <input type="time" className={field} value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
        </label>
        <label className="text-[14px]">
          พขร.เติมน้ำมัน <span className="text-muted">(ไม่บังคับ)</span>
          <input className={field} value={fuelDriver} onChange={(e) => setFuelDriver(e.target.value)} />
        </label>
        <label className="text-[14px]">
          พขร.ดูแลเครื่องจักร <span className="text-muted">(ไม่บังคับ)</span>
          <input className={field} value={machineDriver} onChange={(e) => setMachineDriver(e.target.value)} />
        </label>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg text-earth">รายการเครื่องจักร</h2>
        <datalist id="machine-list">
          {machines.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div className="flex flex-col gap-4">
          {lines.map((l, i) => {
            const le = check.errors.lines[i];
            const warns = check.warnings.filter((w) => w.line === i);
            return (
              <div key={i} className="flex flex-col gap-2">
                <div className="grid grid-cols-[2rem_1fr_auto] items-start gap-3 sm:grid-cols-[2rem_2fr_1fr_1fr_auto]">
                  <span className="pt-3 text-[14px] text-muted">{i + 1}</span>
                  <label className="col-span-2 text-[13px] text-muted sm:col-span-1">
                    รายการหรือรหัสเครื่องจักร
                    <input
                      data-line={i}
                      data-f="machine"
                      list="machine-list"
                      className={`${field} text-ink ${showErr(`m${i}`, le?.machine) ? bad : ""}`}
                      value={l.machine}
                      onChange={(e) => setLine(i, { machine: e.target.value })}
                      onBlur={() => touch(`m${i}`)}
                      placeholder="เช่น PC210, รถหกล้อ 50-9653"
                    />
                    <Err msg={showErr(`m${i}`, le?.machine)} />
                  </label>
                  <label className="text-[13px] text-muted">
                    ชั่วโมงการทำงาน (ไม่บังคับ)
                    <input
                      data-line={i}
                      data-f="hours"
                      inputMode="decimal"
                      className={`${field} num text-ink`}
                      value={l.hourMeter}
                      onChange={(e) => setLine(i, { hourMeter: e.target.value })}
                    />
                  </label>
                  <label className="text-[13px] text-muted">
                    จำนวนน้ำมัน (ลิตร)
                    <input
                      data-line={i}
                      data-f="liters"
                      inputMode="decimal"
                      className={`${field} num text-ink ${showErr(`l${i}`, le?.liters) ? bad : ""}`}
                      value={l.liters}
                      onChange={(e) => setLine(i, { liters: e.target.value })}
                      onBlur={() => touch(`l${i}`)}
                    />
                    <Err msg={showErr(`l${i}`, le?.liters)} />
                  </label>
                  <button type="button" onClick={() => removeLine(i)} className="h-11 self-end text-[14px] text-earth underline">
                    ลบบรรทัด
                  </button>
                </div>
                {warns.map((w, k) => (
                  <p key={k} className="ml-11 rounded-control bg-safety-soft px-3 py-2 text-[13px] text-ink">
                    คำเตือน: {w.message} ตรวจกับใบอีกครั้ง ยังบันทึกได้
                  </p>
                ))}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={addLine}>
            เพิ่มบรรทัด
          </Button>
          <span className="text-[13px] text-muted">หรือกด Enter ที่ช่องลิตรของบรรทัดสุดท้าย</span>
        </div>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-display text-lg text-earth sm:col-span-2">เซ็นรับและรูปแนบ</h2>
        <label className="text-[14px]">
          ผู้เซ็นรับ (สโตร์หรือโฟร์แมน)
          <input
            className={`${field} ${showErr("receiver", check.errors.receiver) ? bad : ""}`}
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            onBlur={() => touch("receiver")}
          />
          <Err msg={showErr("receiver", check.errors.receiver)} />
        </label>
        <label className="flex min-h-11 items-center gap-3 self-end text-[14px]">
          <input
            type="checkbox"
            className="h-6 w-6"
            checked={receivedSigned}
            onChange={(e) => {
              setReceivedSigned(e.target.checked);
              touch("receiver");
            }}
          />
          ใบกระดาษมีลายเซ็นแล้ว
        </label>
        {check.warnings
          .filter((w) => w.kind === "unsigned")
          .map((w, k) => (
            <p key={k} className="rounded-control bg-safety-soft px-3 py-2 text-[13px] sm:col-span-2">
              คำเตือน: {w.message} ยังบันทึกได้
            </p>
          ))}
        <p className="text-[13px] text-muted sm:col-span-2">การแนบรูปใบจ่ายและรูปมิเตอร์ยังไม่เปิดใช้ในรุ่นนี้</p>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <div>
            <div className="text-[13px] text-muted">ยอดของใบนี้</div>
            <div className="font-display text-2xl">
              {badLiters ? (
                <span className="text-[15px] text-muted">แก้ลิตรให้ถูกต้องก่อน</span>
              ) : (
                <>
                  <span className="rounded bg-safety-soft px-1.5">{formatLiters(totalLiters)}</span> ลิตร
                </>
              )}
            </div>
          </div>
          <div>
            <div className="text-[13px] text-muted">
              ราคาวันที่ {issueDate ? thaiShort(issueDate) : "-"}
            </div>
            <div>{price === null ? "ยังไม่มีราคา" : `${formatBaht(price)} บาท/ลิตร`}</div>
          </div>
          <div>
            <div className="text-[13px] text-muted">ยอดเงิน</div>
            <div className="font-display text-xl">{badLiters ? "-" : totalAmount === null ? "รอราคา" : `${formatBaht(totalAmount)} บาท`}</div>
          </div>
        </div>
        {price === null && issueDate && (
          <p className="text-[13px] text-muted">
            บันทึกลิตรได้เลย ยอดเงินจะคิดให้เมื่อมีราคาของวันนั้น (ตั้งราคาของวันนั้นได้ที่หน้าซื้อน้ำมันเข้า)
          </p>
        )}
        {saveError && (
          <p role="alert" className="text-[14px] text-repair">
            {saveError}
          </p>
        )}
        {attempted && !check.ok && (
          <p role="alert" className="text-[14px] text-repair">
            ยังบันทึกไม่ได้ แก้ช่องที่มีข้อความสีแดงในฟอร์มก่อน
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {edit ? (
            <Button type="button" variant="primary" disabled={saving} onClick={() => save("done")}>
              บันทึกการแก้ไข
            </Button>
          ) : (
            <>
              <Button type="button" variant="primary" disabled={saving} onClick={() => save("next")}>
                บันทึกและคีย์ใบถัดไป
              </Button>
              <Button type="button" disabled={saving} onClick={() => save("done")}>
                บันทึก
              </Button>
            </>
          )}
          <Link href={edit ? `/issues/${edit.id}` : "/issues"} className={linkButton()}>
            {edit ? "ไม่แก้แล้ว" : "ยกเลิก ไม่บันทึกใบนี้"}
          </Link>
        </div>
        <p className="text-[13px] text-muted">
          ใบถัดไปจะเปิดเป็นฟอร์มเปล่า คงวันที่เดิม และใส่เลขที่ถัดไปให้ · คีย์ลัด: Tab ไปช่องถัดไป · Enter เพิ่มบรรทัดใหม่ · Ctrl + Enter บันทึก
        </p>
      </Card>
    </form>
  );
}
