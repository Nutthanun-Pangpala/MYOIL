"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Toast } from "@/components/toast";
import { Button, Card, CardTitle, Field, Pill, ProjectChip, StateBox, fieldBadClass, fieldClass } from "@/components/ui";
import { PROJECT_CODE_MAX, PROJECT_DETAIL_MAX, PROJECT_NAME_MAX, PROJECT_REF_MAX } from "@/domain/settings-rules";
import { saveProjectAction, setProjectActiveAction } from "../actions";
import { SettingsHeader } from "../settings-header";

type Row = { id: string; ref: string; code: string | null; name: string; active: boolean; detail: string | null; origin: "local" | "bookcare" | "edited" };
const ORIGIN = { bookcare: "จาก BookCare", local: "เพิ่มเองใน MYOIL", edited: "จาก BookCare แก้ใน MYOIL" } as const;
// OBS-22: a 44px target, not a 26px word
const rowLink = "inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap px-2 text-earth underline hover:text-ink disabled:opacity-60";

/**
 * ตั้งค่า › โครงการ (test round 17, BUG-07; owner 26 Nov 2026): the list is synced from BookCare AND admins add,
 * change the code or name, open and close here. What is changed here stays: the sync never undoes it. The list on the left filters as you type; the add / edit form sits beside it (same shape as เครื่องจักร).
 */
export function ProjectsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "open" | "closed">("all");
  const [done, setDone] = useState<{ n: number; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** OBS-22: closing is asked about first (open slips forms and routes lose the project); opening is not */
  const [closing, setClosing] = useState<Row | null>(null);
  const say = (text: string) => setDone((d) => ({ n: (d?.n ?? 0) + 1, text }));

  const term = q.trim().toLowerCase();
  const open = rows.filter((p) => p.active).length;
  const shown = rows.filter((p) => (show === "all" || (show === "open") === p.active) && (!term || `${p.ref} ${p.code ?? ""} ${p.name}`.toLowerCase().includes(term)));
  const cur = rows.find((r) => r.id === editing);

  function toggle(p: Row) {
    setError(null);
    start(async () => {
      try {
        const r = await setProjectActiveAction(p.id, !p.active);
        if (r.ok) {
          setClosing(null);
          say(r.message ?? "บันทึกแล้ว");
          router.refresh();
        } else setError(r.message ?? "ทำไม่สำเร็จ");
      } catch {
        setError("ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  const chip = (v: typeof show, text: string) => (
    <button
      type="button"
      aria-pressed={show === v}
      onClick={() => setShow(v)}
      className={`min-h-11 rounded-control border px-3 ${show === v ? "border-earth bg-earth text-white" : "border-idle bg-card text-ink"}`}
    >
      {text}
    </button>
  );

  return (
    <>
      <SettingsHeader actions={<Button onClick={() => setEditing("new")}>เพิ่มโครงการ</Button>} />
      <div className="flex flex-col gap-4">
        {open === 0 && (
          <p role="status" className="rounded-control border border-repair bg-card px-[18px] py-3.5">
            <strong className="text-repair">ยังไม่มีโครงการที่เปิดอยู่</strong> ใบจ่ายและเส้นทางรถเติมน้ำมันจะเลือกโครงการไม่ได้ กด “เพิ่มโครงการ” หรือกด “เปิด” ที่โครงการในรายการ
          </p>
        )}
        <div className="flex flex-wrap items-start gap-6">
          <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-0 max-w-[360px] flex-[1_1_240px] flex-col gap-1.5">
                <label htmlFor="s-q" className="text-sm">
                  ค้นหาโครงการ
                </label>
                <input id="s-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์รหัสหรือชื่อ ผลขึ้นทันที" className={fieldClass} />
              </div>
              <div role="group" aria-label="แสดงโครงการ" className="flex flex-wrap gap-2">
                {chip("all", `ทั้งหมด ${rows.length}`)}
                {chip("open", `เปิด ${open}`)}
                {chip("closed", `ปิด ${rows.length - open}`)}
              </div>
            </div>
            {rows.length === 0 ? (
              <StateBox title="ยังไม่มีโครงการ">กด “เพิ่มโครงการ” เพื่อเพิ่มโครงการแรก ใบจ่ายและเส้นทางต้องมีโครงการให้เลือก</StateBox>
            ) : shown.length === 0 ? (
              <StateBox title="ไม่พบโครงการที่ตรงกับคำค้น">ลองพิมพ์รหัสโครงการ รหัสบัญชี หรือบางส่วนของชื่อ หรือเปลี่ยนเป็น “ทั้งหมด”</StateBox>
            ) : (
              <div className="overflow-x-auto">
                <table className="t">
                  <thead>
                    <tr>
                      <th>รหัสโครงการ</th>
                      <th>รหัสบัญชี</th>
                      <th>ชื่อโครงการ</th>
                      <th>สถานะ</th>
                      <th>ที่มา</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <ProjectChip code={p.ref} name={p.name} />
                        </td>
                        <td className="text-muted">{p.code ?? "–"}</td>
                        <td className="text-muted">
                          {p.name}
                          {p.detail ? <span className="block text-[14px]">ที่ตั้ง: {p.detail}</span> : <span className="block text-[14px] text-repair-ink">ยังไม่ใส่ที่ตั้งไซต์</span>}
                        </td>
                        <td>
                          <Pill tone={p.active ? "ok" : "off"}>{p.active ? "เปิด" : "ปิด"}</Pill>
                        </td>
                        <td className="text-[14px] text-muted">{ORIGIN[p.origin]}</td>
                        <td>
                          <span className="flex gap-3">
                            <button type="button" className={rowLink} aria-label={`แก้ไขโครงการ ${p.ref}`} onClick={() => setEditing(p.id)}>
                              แก้ไข
                            </button>
                            <button type="button" className={rowLink} disabled={busy} aria-label={`${p.active ? "ปิด" : "เปิด"}โครงการ ${p.ref}`} onClick={() => (p.active ? (setError(null), setClosing(p)) : toggle(p))}>
                              {p.active ? "ปิด" : "เปิด"}
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {error && !closing && (
              <p role="alert" className="text-[14px] text-repair">
                {error}
              </p>
            )}
            <p className="text-[15px]">
              แสดง {shown.length} จาก {rows.length} โครงการ
            </p>
            <ul className="flex list-disc flex-col gap-0.5 pl-5 text-[15px]">
              <li>โครงการที่ปิดเลือกในใบจ่ายใหม่และเส้นทางไม่ได้ ข้อมูลเดิมยังอยู่ เปิดกลับได้</li>
              <li>รายชื่อดึงจาก BookCare วันละครั้ง</li>
              <li>โครงการที่เพิ่มหรือแก้ในหน้านี้ใช้ค่าที่ตั้งไว้ต่อไป</li>
            </ul>
          </Card>

          {editing && (
            <ProjectForm
              key={editing}
              project={editing === "new" ? null : (cur ?? null)}
              onClose={() => setEditing(null)}
              onSaved={(text) => {
                setEditing(null);
                say(text);
                router.refresh();
              }}
            />
          )}
        </div>
      </div>
      <ConfirmDialog open={closing !== null} title={`ปิดโครงการ ${closing?.ref ?? ""} ใช่ไหม`} onClose={() => setClosing(null)}>
        <p>
          {closing?.name} จะเลือกในใบจ่ายใหม่และเส้นทางรถเติมน้ำมันไม่ได้ ใบจ่ายและใบแจ้งเดิมของโครงการยังอยู่ครบ กด “เปิด” กลับได้ทุกเมื่อ
        </p>
        {error && (
          <p role="alert" className="text-sm text-repair">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-6 pt-1">
          <Button onClick={() => setClosing(null)}>ไม่ปิด</Button>
          <Button variant="danger" disabled={busy} onClick={() => closing && toggle(closing)}>
            ปิดโครงการนี้
          </Button>
        </div>
      </ConfirmDialog>
      {done && <Toast key={done.n}>{done.text}</Toast>}
    </>
  );
}

function ProjectForm({ project, onClose, onSaved }: { project: Row | null; onClose: () => void; onSaved: (text: string) => void }) {
  const [busy, start] = useTransition();
  const [ref, setRef] = useState(project?.ref ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [code, setCode] = useState(project?.code ?? "");
  const [detail, setDetail] = useState(project?.detail ?? "");
  const [err, setErr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const clear = (k: string) => setErr((e) => ({ ...e, [k]: "" }));
  const bad = (k: string) => (err[k] ? fieldBadClass : "");
  const alert = (k: string) => err[k] && <span role="alert">{err[k]}</span>;

  function save() {
    setMsg(null);
    start(async () => {
      try {
        const r = await saveProjectAction(project?.id ?? null, { ref, name, code, detail });
        if (r.ok) onSaved(r.message ?? "บันทึกแล้ว");
        else {
          const errors = (r as { errors?: Record<string, string> }).errors;
          setErr(errors ?? {});
          if (!errors) setMsg(r.message ?? "บันทึกไม่ได้");
          else document.getElementById(errors.ref ? "sp-ref" : errors.name ? "sp-name" : errors.code ? "sp-code" : "sp-detail")?.focus();
        }
      } catch {
        setMsg("บันทึกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  const title = project ? `แก้ไขโครงการ ${project.ref}` : "เพิ่มโครงการ";
  return (
    <div role="form" aria-label={project ? "แก้ไขโครงการ" : "เพิ่มโครงการ"} className="min-w-0 flex-[1_1_340px]">
      <Card className="flex flex-col gap-4 p-6">
        <CardTitle>{title}</CardTitle>
        <Field label="รหัสโครงการ" htmlFor="sp-ref" error={alert("ref")} hint={`ตัวย่อที่ขึ้นในใบจ่ายและใบแจ้ง เช่น PNKK ใช้ A–Z ตัวเลข และขีดกลาง ไม่เกิน ${PROJECT_REF_MAX} ตัว`}>
          <input id="sp-ref" className={`${fieldClass} ${bad("ref")} uppercase`} value={ref} maxLength={PROJECT_REF_MAX + 8} onChange={(e) => (setRef(e.target.value), clear("ref"))} autoFocus autoCapitalize="characters" />
        </Field>
        <Field label="ชื่อโครงการ" htmlFor="sp-name" error={alert("name")}>
          <input id="sp-name" className={`${fieldClass} ${bad("name")}`} value={name} maxLength={PROJECT_NAME_MAX + 50} onChange={(e) => (setName(e.target.value), clear("name"))} />
        </Field>
        <Field label="รหัสบัญชี" htmlFor="sp-code" optional error={alert("code")} hint="รหัสที่ฝ่ายบัญชีใช้ พิมพ์ต่อท้ายรหัสโครงการในใบแจ้งค่าใช้จ่าย">
          <input id="sp-code" className={`${fieldClass} ${bad("code")}`} value={code} maxLength={PROJECT_CODE_MAX + 10} onChange={(e) => (setCode(e.target.value), clear("code"))} />
        </Field>
        <Field label="ที่ตั้งไซต์ สำหรับ พขร." htmlFor="sp-detail" optional error={alert("detail")} hint="ที่อยู่ เขต หรือจุดสังเกต ขึ้นบนมือถือของ พขร. ใต้ชื่อไซต์ เช่น ซอยลำลูกกา 11 ตรงข้ามปั๊ม ปตท.">
          <textarea id="sp-detail" rows={2} className={`${fieldClass} ${bad("detail")} h-auto min-h-[72px] resize-y py-2.5`} value={detail} maxLength={PROJECT_DETAIL_MAX + 50} onChange={(e) => (setDetail(e.target.value), clear("detail"))} />
        </Field>
        {project && (
          <p className="text-[14px] text-muted">
            ใบจ่าย เส้นทาง และใบแจ้งเดิมของโครงการนี้จะแสดงรหัสและชื่อใหม่ทันที{project.origin !== "local" ? " โครงการนี้มาจาก BookCare เมื่อแก้ที่นี่แล้ว ค่าที่ตั้งในหน้านี้จะใช้ต่อไป แม้ BookCare เปลี่ยนภายหลัง" : ""}
          </p>
        )}
        {msg && (
          <p role="alert" className="text-[14px] text-repair">
            {msg}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" disabled={busy} onClick={save}>
            {project ? "บันทึก" : "เพิ่มโครงการ"}
          </Button>
          <Button onClick={onClose}>ยกเลิก</Button>
        </div>
      </Card>
    </div>
  );
}
