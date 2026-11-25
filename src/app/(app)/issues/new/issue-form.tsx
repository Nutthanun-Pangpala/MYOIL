"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Toast } from "@/components/toast";
import { Button, Card, Kbd, Pill, linkButton } from "@/components/ui";
import { checkIssue, nextDocNo, type IssueCheck, type IssueInput } from "@/domain/issue-check";
import { hasAtMostTwoDecimals, lineAmount, sumAmounts, sumLiters } from "@/domain/money";
import { thaiShort } from "@/domain/thai-date";
import { formatBaht, formatLiters } from "@/lib/format";
import { shrinkImage } from "@/lib/image-shrink";
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

/** design 6.4: the paper slip's fields top to bottom on the left; what it adds up to and the save buttons on the right */
export function IssueForm({
  projects,
  machines,
  initial,
  saved,
  keyedToday,
  edit,
}: {
  projects: Project[];
  machines: string[];
  initial: { issueDate: string; bookNo: string; docNo: string };
  /** the slip saved just before ("บันทึกและคีย์ใบถัดไป"): a short message with a link to it */
  saved: { id: string | null; label: string } | null;
  /** "วันนี้คีย์แล้ว n ใบ" */
  keyedToday?: number;
  /** editing a saved slip: its id, the values it holds now, the project as the box shows it, when it was keyed */
  edit?: { id: string; input: IssueInput; projectText: string; savedAt: string | null };
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
  // photo of the signed paper (new slips only; an existing slip gets it on its own page)
  const [slipPhoto, setSlipPhoto] = useState<{ mime: string; base64: string } | null>(null);
  const [slipPhotoName, setSlipPhotoName] = useState("");
  const [slipPhotoError, setSlipPhotoError] = useState<string | null>(null);

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
    if (saving) return; // Ctrl+Enter while the first save is still on its way must not send the slip twice (OBS-34)
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
        const res = await saveIssueAction(input, slipPhoto);
        if (res.ok) {
          if (res.photoError) {
            // the slip is saved; only the picture failed → say so on the slip's page, where it can be attached again
            router.push(`/issues/${res.id}?saved=1&photo=failed`);
          } else if (mode === "next") {
            const q = new URLSearchParams({ saved: "1", last: res.id, lastNo: `${bookNo.trim()}/${docNo.trim()}`, date: issueDate, book: bookNo.trim(), doc: nextDocNo(docNo) });
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

  const field = "h-11 w-full min-w-0 rounded-control border border-idle bg-card px-3 text-ink";
  const bad = "border-2 border-repair";
  const Err = ({ msg }: { msg?: string }) =>
    msg ? (
      <p role="alert" className="mt-0.5 text-[13px] leading-normal text-repair">
        บันทึกไม่ได้: {msg}
      </p>
    ) : null;
  const Warn = ({ children }: { children: React.ReactNode }) => <p className="mt-0.5 text-[13px] leading-normal text-warn-ink">คำเตือน: {children}</p>;
  const Lbl = ({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) => (
    <label htmlFor={htmlFor} className="text-sm">
      {children}
      {optional && <span className="text-muted"> (ไม่บังคับ)</span>}
    </label>
  );
  const sub = "font-display text-base font-medium leading-[1.4] text-muted";
  const unsignedWarn = check.warnings.find((w) => w.kind === "unsigned");
  const nextNo = bookNo.trim() && docNo.trim() ? `ใส่เล่มที่ ${bookNo.trim()} เลขที่ ${nextDocNo(docNo)} ให้` : "ใส่เลขที่ถัดไปให้";

  async function takePhoto(f: File | undefined) {
    setSlipPhotoError(null);
    if (!f) return (setSlipPhoto(null), setSlipPhotoName(""));
    const small = await shrinkImage(f);
    if (!small) return (setSlipPhoto(null), setSlipPhotoName(""), setSlipPhotoError("เปิดรูปนี้ไม่ได้ เลือกไฟล์ JPG หรือ PNG"));
    setSlipPhoto(small);
    setSlipPhotoName(f.name);
  }

  return (
    <form
      className="flex flex-col gap-6"
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
      <header className="flex flex-col gap-1">
        <Link href={edit ? `/issues/${edit.id}` : "/issues"} className="self-start text-sm text-earth underline hover:text-ink">
          {edit ? "กลับไปดูใบจ่ายนี้" : "กลับไปรายการใบจ่าย"}
        </Link>
        <h1 className="font-display text-[34px] font-semibold leading-[1.3]">{edit ? `แก้ไขใบจ่าย เล่มที่ ${edit.input.bookNo} เลขที่ ${edit.input.docNo}` : "บันทึกใบจ่าย"}</h1>
      </header>
      {saved && <Toast link={saved.id ? { href: `/issues/${saved.id}`, label: "ดูใบ" } : undefined}>{saved.label}</Toast>}

      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[999_1_620px] p-7">
          <div className="flex flex-col gap-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <h2 className="font-display text-xl font-medium leading-[1.4]">ใบเบิกน้ำมันเชื้อเพลิง</h2>
              <span className="text-muted">
                {edit
                  ? `กำลังแก้ใบที่บันทึกไว้${edit.savedAt ? `เมื่อ ${thaiShort(new Date(edit.savedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }))}` : ""} การแก้ทุกครั้งเก็บในประวัติของใบ`
                  : `ช่องเรียงตามใบกระดาษจากบนลงล่าง${keyedToday ? ` วันนี้คีย์แล้ว ${keyedToday} ใบ` : ""}`}
              </span>
            </div>

            <section className="flex flex-col gap-3.5" aria-labelledby="h-head">
              <h3 id="h-head" className={sub}>
                หัวใบ
              </h3>
              <div className="flex flex-wrap gap-4">
                <div className="flex min-w-0 flex-[1_1_120px] flex-col gap-1.5">
                  <Lbl htmlFor="n-book">เล่มที่</Lbl>
                  <input
                    id="n-book"
                    className={`${field} ${showErr("book", check.errors.book) ? bad : ""}`}
                    value={bookNo}
                    onChange={(e) => setBookNo(e.target.value)}
                    onBlur={() => touch("book")}
                    onFocus={(e) => e.target.select()}
                    inputMode="numeric"
                    autoFocus={!edit && !initial.bookNo}
                  />
                  <Err msg={showErr("book", check.errors.book)} />
                </div>
                <div className="flex min-w-0 flex-[1_1_120px] flex-col gap-1.5">
                  <Lbl htmlFor="n-no">เลขที่</Lbl>
                  <input
                    id="n-no"
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
                    <Link href={`/issues/${server.duplicateIssueId}`} className="text-[13px] text-repair underline" target="_blank">
                      เปิดดูใบเดิม
                    </Link>
                  )}
                </div>
                <div className="flex min-w-0 flex-[1_1_140px] flex-col gap-1.5">
                  <Lbl htmlFor="n-date">วันที่ {issueDate && <span className="text-muted">({thaiShort(issueDate)})</span>}</Lbl>
                  <input
                    id="n-date"
                    type="date"
                    className={`${field} ${showErr("date", check.errors.date) ? bad : ""}`}
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    onBlur={() => touch("date")}
                  />
                  <Err msg={showErr("date", check.errors.date)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex min-w-0 flex-[3_1_260px] flex-col gap-1.5">
                  <Lbl htmlFor="n-proj">โครงการ</Lbl>
                  <input
                    id="n-proj"
                    className={`${field} ${showErr("project", check.errors.project) ? bad : ""}`}
                    list="project-list"
                    value={projectText}
                    onChange={(e) => setProjectText(e.target.value)}
                    onBlur={() => touch("project")}
                    placeholder="พิมพ์รหัสหรือชื่อเพื่อค้นหา"
                  />
                  <datalist id="project-list">
                    {projects.map((p) => (
                      <option key={p.id} value={projectLabel(p)} />
                    ))}
                  </datalist>
                  <Err msg={showErr("project", check.errors.project)} />
                </div>
                <div className="flex min-w-0 flex-[1_1_110px] flex-col gap-1.5">
                  <Lbl htmlFor="n-in" optional>
                    เวลาเข้า
                  </Lbl>
                  <input id="n-in" type="time" className={field} value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
                </div>
                <div className="flex min-w-0 flex-[1_1_110px] flex-col gap-1.5">
                  <Lbl htmlFor="n-out" optional>
                    เวลาออก
                  </Lbl>
                  <input id="n-out" type="time" className={field} value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
                  <Lbl htmlFor="n-drv" optional>
                    พขร.เติมน้ำมัน
                  </Lbl>
                  <input id="n-drv" className={field} value={fuelDriver} onChange={(e) => setFuelDriver(e.target.value)} />
                </div>
                <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
                  <Lbl htmlFor="n-op" optional>
                    พขร.ดูแลเครื่องจักร
                  </Lbl>
                  <input id="n-op" className={field} value={machineDriver} onChange={(e) => setMachineDriver(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3.5" aria-labelledby="h-lines">
              <h3 id="h-lines" className={sub}>
                รายการเครื่องจักร
              </h3>
              <datalist id="machine-list">
                {machines.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <div className="overflow-x-auto">
                <table className="t top">
                  <thead>
                    <tr>
                      <th className="w-9">ลำดับ</th>
                      <th>รายการหรือรหัสเครื่องจักร</th>
                      <th className="w-[220px]">
                        ชั่วโมงการทำงาน <span className="font-normal">(ไม่บังคับ)</span>
                      </th>
                      <th className="w-[170px]">จำนวนน้ำมัน (ลิตร)</th>
                      <th className="w-14">
                        <span className="sr-only">ลบบรรทัด</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const le = check.errors.lines[i];
                      const warns = check.warnings.filter((w) => w.line === i);
                      const hoursWarn = warns.filter((w) => w.kind === "hours");
                      const litersWarn = warns.filter((w) => w.kind !== "hours");
                      return (
                        <tr key={i}>
                          <td className="pt-[22px] text-center text-muted">{i + 1}</td>
                          <td>
                            <input
                              data-line={i}
                              data-f="machine"
                              list="machine-list"
                              aria-label={`รายการหรือรหัสเครื่องจักร บรรทัดที่ ${i + 1}`}
                              className={`${field} ${showErr(`m${i}`, le?.machine) ? bad : ""}`}
                              value={l.machine}
                              onChange={(e) => setLine(i, { machine: e.target.value })}
                              onBlur={() => touch(`m${i}`)}
                              placeholder="พิมพ์เพื่อค้นหา หรือเพิ่มเครื่องใหม่"
                            />
                            <Err msg={showErr(`m${i}`, le?.machine)} />
                          </td>
                          <td>
                            <input
                              data-line={i}
                              data-f="hours"
                              inputMode="decimal"
                              aria-label={`ชั่วโมงการทำงาน บรรทัดที่ ${i + 1}`}
                              className={`${field} text-right tabular-nums`}
                              value={l.hourMeter}
                              onChange={(e) => setLine(i, { hourMeter: e.target.value })}
                            />
                            {hoursWarn.map((w, k) => (
                              <Warn key={k}>{w.message} ตรวจกับใบอีกครั้ง ยังบันทึกได้</Warn>
                            ))}
                          </td>
                          <td>
                            <input
                              data-line={i}
                              data-f="liters"
                              inputMode="decimal"
                              aria-label={`จำนวนน้ำมัน (ลิตร) บรรทัดที่ ${i + 1}`}
                              className={`${field} text-right tabular-nums ${showErr(`l${i}`, le?.liters) ? bad : ""}`}
                              value={l.liters}
                              onChange={(e) => setLine(i, { liters: e.target.value })}
                              onBlur={() => touch(`l${i}`)}
                            />
                            <Err msg={showErr(`l${i}`, le?.liters)} />
                            {litersWarn.map((w, k) => (
                              <Warn key={k}>{w.message} ตรวจกับใบอีกครั้ง ยังบันทึกได้</Warn>
                            ))}
                          </td>
                          <td>
                            <button type="button" aria-label={`ลบบรรทัดที่ ${i + 1}`} onClick={() => removeLine(i)} className="min-h-11 px-3 text-earth underline hover:text-ink">
                              ลบ
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={addLine}>
                  เพิ่มบรรทัด
                </Button>
                <span className="text-sm text-muted">
                  หรือกด <Kbd>Enter</Kbd> ที่ช่องลิตรของบรรทัดสุดท้าย
                </span>
              </div>
            </section>

            <section className="flex flex-col gap-3.5" aria-labelledby="h-sign">
              <h3 id="h-sign" className={sub}>
                เซ็นรับและรูปแนบ
              </h3>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
                  <Lbl htmlFor="n-sign">ผู้เซ็นรับ (สโตร์หรือโฟร์แมน)</Lbl>
                  <input
                    id="n-sign"
                    className={`${field} ${showErr("receiver", check.errors.receiver) ? bad : ""}`}
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    onBlur={() => touch("receiver")}
                  />
                  <Err msg={showErr("receiver", check.errors.receiver)} />
                </div>
                <div className="flex min-h-11 flex-[1_1_260px] flex-col justify-center sm:pt-[27px]">
                  <div className="flex min-h-11 items-center gap-2.5">
                    <input
                      id="n-signed"
                      type="checkbox"
                      className="size-5"
                      checked={receivedSigned}
                      onChange={(e) => {
                        setReceivedSigned(e.target.checked);
                        touch("receiver");
                      }}
                    />
                    <label htmlFor="n-signed">ใบกระดาษมีลายเซ็นแล้ว</label>
                  </div>
                  {unsignedWarn && <Warn>{unsignedWarn.message} ยังบันทึกได้</Warn>}
                </div>
              </div>
              {!edit ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm">
                    รูปแนบ <span className="text-muted">(ไม่บังคับ)</span>
                  </span>
                  <div
                    className="flex flex-wrap items-center gap-3 rounded-control border border-dashed border-idle bg-page p-4"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void takePhoto(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <input id="slip-photo" type="file" accept="image/*" aria-label="รูปใบเซ็น" className="peer sr-only" onChange={(e) => void takePhoto(e.target.files?.[0])} />
                    <label htmlFor="slip-photo" className={`${linkButton("secondary")} cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-earth`}>
                      เลือกรูป
                    </label>
                    <span className="text-sm text-muted">{slipPhotoName ? `แนบแล้ว: ${slipPhotoName}` : "รูปใบจ่ายที่เซ็นแล้ว 1 รูป หรือลากไฟล์มาวาง แนบทีหลังที่หน้าใบก็ได้"}</span>
                  </div>
                  {slipPhotoError && (
                    <span role="alert" className="text-[13px] text-repair">
                      {slipPhotoError}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted">รูปใบเซ็นแนบ เปลี่ยน หรือลบได้ที่หน้าใบจ่าย</p>
              )}
            </section>
          </div>
        </Card>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <section aria-label="ยอดของใบนี้" className="flex flex-col gap-3.5 rounded-card bg-tank px-6 pb-6 pt-[22px] text-white">
            <h2 className="font-display text-lg font-medium leading-[1.4] text-page">ยอดของใบนี้</h2>
            {badLiters ? (
              <span className="text-[15px] text-tank-text">แก้ลิตรให้ถูกต้องก่อน</span>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[56px] font-semibold leading-none text-safety">{formatLiters(totalLiters)}</span>
                <span className="font-display text-xl text-page">ลิตร</span>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-tank-text">ราคาวันที่ {issueDate ? thaiShort(issueDate) : "-"}</span>
                <span>{price === null ? "ยังไม่มีราคา" : `${formatBaht(price)} บาท/ลิตร`}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/16 pt-3">
                <span className="text-tank-text">ยอดเงิน</span>
                {badLiters ? (
                  <span className="font-display text-2xl font-medium">-</span>
                ) : totalAmount === null ? (
                  <Pill tone="wait">รอราคา</Pill>
                ) : (
                  <span className="font-display text-2xl font-medium">{formatBaht(totalAmount)} บาท</span>
                )}
              </div>
              {price === null && issueDate && (
                <span className="text-sm text-tank-text">
                  บันทึกลิตรได้เลย ยอดเงินจะคิดให้เมื่อมีบิลซื้อที่ลงวันที่ไม่เกินวันนี้ของใบ{" "}
                  <Link href={`/purchases?month=${issueDate.slice(0, 7)}&new=purchase&date=${issueDate}`} className="text-white underline">
                    บันทึกการซื้อ
                  </Link>
                </span>
              )}
            </div>
          </section>

          <div className="flex flex-col gap-3">
            {edit ? (
              <Button type="button" variant="primary" className="w-full" disabled={saving} onClick={() => save("done")}>
                บันทึกการแก้ไข
              </Button>
            ) : (
              <>
                <Button type="button" variant="primary" className="w-full" disabled={saving} onClick={() => save("next")}>
                  บันทึกและคีย์ใบถัดไป
                </Button>
                <Button type="button" className="w-full" disabled={saving} onClick={() => save("done")}>
                  บันทึก
                </Button>
              </>
            )}
            {saving && (
              <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted">
                <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-idle border-t-transparent" />
                กำลังบันทึก รอสักครู่ ไม่ต้องกดซ้ำ
              </p>
            )}
            {saveError && (
              <p role="alert" className="text-sm text-repair">
                {saveError}
              </p>
            )}
            {attempted && !check.ok && (
              <p role="alert" className="text-sm text-repair">
                ยังบันทึกไม่ได้ แก้ช่องที่มีข้อความสีแดงในฟอร์มก่อน
              </p>
            )}
          </div>
          <Link href={edit ? `/issues/${edit.id}` : "/issues"} className="self-center py-1.5 text-earth underline hover:text-ink">
            {edit ? "ยกเลิกการแก้ไข" : "ยกเลิก ไม่บันทึกใบนี้"}
          </Link>
          {!edit && <p className="text-sm text-muted">ใบถัดไปจะเปิดเป็นฟอร์มเปล่า คงวันที่เดิม และ{nextNo}</p>}

          <Card className="p-5">
            <div className="flex flex-col gap-2.5 text-sm">
              <h2 className="font-display text-xl font-medium leading-[1.4]">คีย์ลัด</h2>
              <div className="flex items-center gap-2.5">
                <Kbd>Tab</Kbd>
                <span>ไปช่องถัดไป</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Kbd>Enter</Kbd>
                <span>เพิ่มบรรทัดใหม่ เมื่ออยู่ที่ช่องลิตรบรรทัดสุดท้าย</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Kbd>Ctrl + Enter</Kbd>
                <span>บันทึก</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
