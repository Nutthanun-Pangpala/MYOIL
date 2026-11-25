"use client";

import { MACHINE_CODE_MAX } from "@/domain/settings-rules";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toast } from "@/components/toast";
import { Button, Card, CardTitle, Field, Pill, StateBox, fieldBadClass, fieldClass } from "@/components/ui";
import { saveMachineAction } from "../actions";
import { SettingsHeader } from "../settings-header";

type Row = { id: string; code: string; name: string | null; type: string | null; assetCode: string | null; isRented: boolean };
const TYPES = ["รถขุด", "รถ", "เครื่องจักร", "อื่น ๆ"];
const rowLink = "min-h-11 whitespace-nowrap px-1 text-earth underline hover:text-ink";

/** design 6.11 เครื่องจักร: the list on the left, the add / edit form beside it */
export function MachinesPanel({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [q, setQ] = useState("");
  const [done, setDone] = useState<{ n: number; text: string } | null>(null);
  const cur = rows.find((r) => r.id === editing);
  const term = q.trim().toLowerCase();
  const shown = term ? rows.filter((r) => `${r.code} ${r.name ?? ""} ${r.assetCode ?? ""}`.toLowerCase().includes(term)) : rows;

  return (
    <>
      <SettingsHeader actions={<Button onClick={() => setEditing("new")}>เพิ่มเครื่องจักร</Button>} />
      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-6">
          <div className="flex max-w-[360px] flex-col gap-1.5">
            <label htmlFor="sm-q" className="text-sm">
              ค้นหาเครื่องจักร
            </label>
            <input id="sm-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์รหัส ทะเบียน หรือชื่อ" className={fieldClass} />
          </div>
          {rows.length === 0 ? (
            <StateBox title="ยังไม่มีเครื่องจักร">กดเพิ่มเครื่องจักร หรือเพิ่มระหว่างคีย์ใบจ่ายก็ได้</StateBox>
          ) : shown.length === 0 ? (
            <StateBox title="ไม่พบเครื่องจักรที่ตรงกับคำค้น">ลองพิมพ์รหัส ทะเบียน หรือบางส่วนของชื่อ</StateBox>
          ) : (
            <div className="overflow-x-auto">
              <table className="t">
                <thead>
                  <tr>
                    <th>รหัสหรือทะเบียน</th>
                    <th>ชื่อ</th>
                    <th>ประเภท</th>
                    <th>รหัสทรัพย์สิน</th>
                    <th>ของบริษัทหรือเช่า</th>
                    <th>
                      <span className="sr-only">แก้ไข</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold">{r.code}</td>
                      <td className="text-muted">{r.name ?? "–"}</td>
                      <td>{r.type ?? "–"}</td>
                      <td className="text-muted">{r.assetCode ?? "–"}</td>
                      <td>
                        <Pill tone={r.isRented ? "wait" : "ok"}>{r.isRented ? "เช่า" : "ของบริษัท"}</Pill>
                      </td>
                      <td>
                        <button type="button" className={rowLink} onClick={() => setEditing(r.id)}>
                          แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[14px] text-muted">เครื่องที่แอดมินเพิ่มเองขณะคีย์ใบจ่ายจะมาอยู่ในรายการนี้</p>
        </Card>

        {editing && (
          <MachineForm
            key={editing}
            machine={editing === "new" ? null : (cur ?? null)}
            onClose={() => setEditing(null)}
            onSaved={(text) => {
              setEditing(null);
              setDone((d) => ({ n: (d?.n ?? 0) + 1, text }));
              router.refresh();
            }}
          />
        )}
      </div>
      {done && <Toast key={done.n}>{done.text}</Toast>}
    </>
  );
}

function MachineForm({ machine, onClose, onSaved }: { machine: Row | null; onClose: () => void; onSaved: (text: string) => void }) {
  const [busy, start] = useTransition();
  const [code, setCode] = useState(machine?.code ?? "");
  const [name, setName] = useState(machine?.name ?? "");
  const [type, setType] = useState(machine?.type ?? TYPES[0]);
  const [rented, setRented] = useState(machine?.isRented ?? false);
  const [asset, setAsset] = useState(machine?.assetCode ?? "");
  const [err, setErr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      try {
        const r = await saveMachineAction(machine?.id ?? null, { code, name, type, assetCode: asset, isRented: rented });
        if (r.ok) onSaved(machine ? `บันทึกเครื่องจักร ${code.trim()} แล้ว` : `เพิ่มเครื่องจักร ${code.trim()} แล้ว`);
        else {
          setErr((r as { errors?: Record<string, string> }).errors ?? {});
          if (!(r as { errors?: unknown }).errors) setMsg(r.message ?? "บันทึกไม่ได้");
        }
      } catch {
        setMsg("บันทึกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  }

  return (
    <div role="form" aria-label={machine ? "แก้ไขเครื่องจักร" : "เพิ่มเครื่องจักร"} className="min-w-0 flex-[1_1_340px]">
      <Card className="flex flex-col gap-4 p-6">
        <CardTitle>{machine ? `แก้ไขเครื่องจักร ${machine.code}` : "เพิ่มเครื่องจักร"}</CardTitle>
        <Field label="รหัสหรือทะเบียน" htmlFor="sm-code" error={err.code && <span role="alert">{err.code}</span>}>
          <input
            id="sm-code"
            className={`${fieldClass} ${err.code ? fieldBadClass : ""}`}
            value={code}
            placeholder="เช่น PC210 หรือ 50-9653"
            maxLength={MACHINE_CODE_MAX}
            onChange={(e) => (setCode(e.target.value), setErr({}))}
            autoFocus
          />
        </Field>
        <Field label="ชื่อ" htmlFor="sm-name" optional>
          <input id="sm-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="ประเภท" htmlFor="sm-kind">
          <select id="sm-kind" className={fieldClass} value={type} onChange={(e) => setType(e.target.value)}>
            {[...new Set([type, ...TYPES])].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <fieldset className="flex flex-col gap-0.5">
          <legend className="text-sm">เจ้าของ</legend>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="sm-own" checked={!rented} onChange={() => setRented(false)} className="size-5" /> ของบริษัท
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="sm-own" checked={rented} onChange={() => setRented(true)} className="size-5" /> เช่า ไม่มีรหัสทรัพย์สิน
          </label>
        </fieldset>
        {!rented && (
          <Field label="รหัสทรัพย์สิน" htmlFor="sm-asset" optional>
            <input id="sm-asset" className={fieldClass} value={asset} onChange={(e) => setAsset(e.target.value)} />
          </Field>
        )}
        {msg && (
          <p role="alert" className="text-[14px] text-repair">
            {msg}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" disabled={busy} onClick={save}>
            {machine ? "บันทึก" : "เพิ่มเครื่องจักร"}
          </Button>
          <Button onClick={onClose}>ยกเลิก</Button>
        </div>
      </Card>
    </div>
  );
}
