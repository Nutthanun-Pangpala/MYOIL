"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { saveMachineAction } from "../actions";

type Row = { id: string; code: string; name: string | null; type: string | null; assetCode: string | null; isRented: boolean };
const TYPES = ["รถขุด", "รถ", "เครื่องจักร", "อื่น ๆ"];
const field = "h-11 w-full rounded-control border border-line bg-card px-3 text-[15px]";

export function MachinesPanel({ rows, q }: { rows: Row[]; q: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const cur = rows.find((r) => r.id === editing);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            ค้นหาเครื่องจักร
            <input type="search" name="q" defaultValue={q} placeholder="รหัส ทะเบียน หรือชื่อ" className="h-11 rounded-control border border-line bg-card px-3 text-[15px]" />
          </label>
          <Button type="submit">ค้นหา</Button>
        </form>
        <Button variant="primary" onClick={() => setEditing("new")}>
          เพิ่มเครื่องจักร
        </Button>
      </div>

      {editing && <MachineForm key={editing} machine={editing === "new" ? null : cur ?? null} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), router.refresh())} />}

      <Card className="overflow-x-auto p-2">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-muted">{q ? "ไม่พบเครื่องจักรที่ตรงกับคำค้น" : "ยังไม่มีเครื่องจักร"}</p>
        ) : (
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="text-left text-muted">
                {["รหัสหรือทะเบียน", "ชื่อ", "ประเภท", "รหัสทรัพย์สิน", "ของบริษัทหรือเช่า", ""].map((h, i) => (
                  <th key={i} className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-3 font-medium">{r.code}</td>
                  <td className="px-3 py-3">{r.name ?? "–"}</td>
                  <td className="px-3 py-3">{r.type ?? "–"}</td>
                  <td className="px-3 py-3">{r.assetCode ?? "–"}</td>
                  <td className="px-3 py-3">
                    <Pill tone={r.isRented ? "wait" : "ok"}>{r.isRented ? "เช่า" : "ของบริษัท"}</Pill>
                  </td>
                  <td className="px-3 py-3">
                    <button type="button" className="text-earth underline" onClick={() => setEditing(r.id)}>
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-[13px] text-muted">เครื่องที่แอดมินเพิ่มเองขณะคีย์ใบจ่ายจะมาอยู่ในรายการนี้</p>
    </div>
  );
}

function MachineForm({ machine, onClose, onSaved }: { machine: Row | null; onClose: () => void; onSaved: () => void }) {
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
        if (r.ok) onSaved();
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
    <div role="form" aria-label={machine ? "แก้ไขเครื่องจักร" : "เพิ่มเครื่องจักร"} className="max-w-xl">
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-display text-xl font-medium">{machine ? "แก้ไขเครื่องจักร" : "เพิ่มเครื่องจักร"}</h2>
      <label className="text-[14px]">
        รหัสหรือทะเบียน
        <input className={`${field} ${err.code ? "border-repair" : ""}`} value={code} onChange={(e) => (setCode(e.target.value), setErr({}))} autoFocus />
        {err.code && (
          <span role="alert" className="text-[13px] text-repair">
            {err.code}
          </span>
        )}
      </label>
      <label className="text-[14px]">
        ชื่อ (ไม่บังคับ)
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="text-[14px]">
        ประเภท
        <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
          {[...new Set([type, ...TYPES])].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1 text-[14px]">
        <legend>เจ้าของ</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" checked={!rented} onChange={() => setRented(false)} className="h-5 w-5" /> ของบริษัท
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" checked={rented} onChange={() => setRented(true)} className="h-5 w-5" /> เช่า ไม่มีรหัสทรัพย์สิน
        </label>
      </fieldset>
      {!rented && (
        <label className="text-[14px]">
          รหัสทรัพย์สิน (ไม่บังคับ)
          <input className={field} value={asset} onChange={(e) => setAsset(e.target.value)} />
        </label>
      )}
      {msg && (
        <p role="alert" className="text-[14px] text-repair">
          {msg}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="primary" disabled={busy} onClick={save}>
          {machine ? "บันทึก" : "เพิ่มเครื่องจักร"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          ยกเลิก
        </Button>
      </div>
    </Card>
    </div>
  );
}
