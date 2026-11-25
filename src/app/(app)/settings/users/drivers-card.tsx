"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Toast } from "@/components/toast";
import { Button, Card, CardTitle, Field, Pill, StateBox, fieldBadClass, fieldClass } from "@/components/ui";
import { createDriverAction, resetDriverPinAction, setDriverActiveAction, updateDriverAction } from "../actions";

type Driver = { id: string; name: string; phone: string; active: boolean; lockedMinutes: number };
type Errors = Partial<Record<"name" | "phone", string>>;
type Mode = { kind: "add" } | { kind: "edit" | "reset" | "toggle"; id: string } | null;
type Answer = { ok: boolean; message?: string; errors?: Errors; pin?: string };

const rowLink = "min-h-11 whitespace-nowrap px-1 text-earth underline hover:text-ink";
const showPhone = (p: string) => (p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : p);

/**
 * ตั้งค่า › ผู้ใช้ › คนขับรถเติมน้ำมัน: accounts that sign in at /login/driver with phone + PIN.
 * The PIN is made by the system and shown once (after adding, after "ตั้ง PIN ใหม่").
 */
export function DriversCard({ drivers }: { drivers: Driver[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [pin, setPin] = useState<{ name: string; phone: string; pin: string } | null>(null);
  const [done, setDone] = useState<{ n: number; text: string } | null>(null);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const target = mode && mode.kind !== "add" ? drivers.find((d) => d.id === mode.id) : undefined;
  const close = () => (setMode(null), setMsg(null));

  const finish = (text: string, shown?: { name: string; phone: string; pin: string }) => {
    setMode(null);
    setMsg(null);
    if (shown) setPin(shown);
    else setDone((d) => ({ n: (d?.n ?? 0) + 1, text }));
    router.refresh();
  };
  const run = (fn: () => Promise<Answer>, after: (r: Answer) => void) =>
    start(async () => {
      setMsg(null);
      try {
        const r = await fn();
        if (r.ok) after(r);
        else setMsg(r.message ?? "ทำรายการไม่ได้");
      } catch {
        setMsg("ทำรายการไม่ได้ ลองอีกครั้ง");
      }
    });

  return (
    <section aria-labelledby="drivers-h" className="flex flex-wrap items-start gap-6">
      <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>
            <span id="drivers-h">คนขับรถเติมน้ำมัน</span>
          </CardTitle>
          <Button variant="primary" onClick={() => setMode({ kind: "add" })}>เพิ่มคนขับ</Button>
        </div>
        {drivers.length === 0 ? (
          <StateBox title="ยังไม่มีบัญชีคนขับ">กดเพิ่มคนขับ ใส่ชื่อกับเบอร์มือถือ ระบบจะออก PIN 6 หลักให้</StateBox>
        ) : (
          <div className="overflow-x-auto">
            <table className="t">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>เบอร์โทรที่ใช้เข้าระบบ</th>
                  <th>สถานะ</th>
                  <th>
                    <span className="sr-only">จัดการ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.name}</td>
                    <td className="whitespace-nowrap">{showPhone(d.phone)}</td>
                    <td>
                      <span className="flex flex-wrap gap-1.5">
                        <Pill tone={d.active ? "ok" : "off"}>{d.active ? "ใช้งานอยู่" : "ปิดบัญชีแล้ว"}</Pill>
                        {d.active && d.lockedMinutes > 0 && <Pill tone="off">ใส่ PIN ผิดเกิน พักอีก {d.lockedMinutes} นาที</Pill>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <button type="button" className={rowLink} onClick={() => setMode({ kind: "edit", id: d.id })}>
                        แก้ไข
                      </button>{" "}
                      <button type="button" className={rowLink} onClick={() => setMode({ kind: "reset", id: d.id })}>
                        ตั้ง PIN ใหม่
                      </button>{" "}
                      <button type="button" className={rowLink} onClick={() => setMode({ kind: "toggle", id: d.id })}>
                        {d.active ? "ปิดบัญชี" : "เปิดบัญชี"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[14px] text-muted">คนขับเข้าระบบที่หน้า “คนขับเข้าสู่ระบบ” ด้วยเบอร์โทรกับ PIN 6 หลัก ระบบออก PIN ให้และแสดงครั้งเดียว ถ้าลืมให้กดตั้ง PIN ใหม่</p>
      </Card>

      {mode?.kind === "add" && <DriverForm key="add" onCancel={close} onDone={(r, d) => finish(r.message ?? "", r.pin ? { ...d, pin: r.pin } : undefined)} />}
      {mode?.kind === "edit" && target && <DriverForm key={target.id} driver={target} onCancel={close} onDone={(r) => finish(r.message ?? "บันทึกคนขับแล้ว")} />}

      <ConfirmDialog open={mode?.kind === "reset" && !!target} title={`ตั้ง PIN ใหม่ให้ ${target?.name ?? ""} ใช่ไหม`} onClose={close}>
        {target && (
          <>
            <p>PIN เดิมจะใช้ไม่ได้ทันที ระบบจะออก PIN ใหม่ 6 หลักและแสดงให้เห็นครั้งเดียว ถ้าบัญชีถูกพักเพราะใส่ผิด จะกลับมาใช้ได้เลย</p>
            {msg && <p role="alert" className="text-repair">{msg}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close}>
                ไม่ตั้งใหม่
              </Button>
              <Button variant="primary" disabled={busy} onClick={() => run(() => resetDriverPinAction(target.id), (r) => finish(r.message ?? "", r.pin ? { name: target.name, phone: target.phone, pin: r.pin } : undefined))}>
                ตั้ง PIN ใหม่
              </Button>
            </div>
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog open={mode?.kind === "toggle" && !!target} title={`${target?.active ? "ปิดบัญชี" : "เปิดบัญชี"}ของ ${target?.name ?? ""} ใช่ไหม`} onClose={close}>
        {target && (
          <>
            <p>{target.active ? "คนขับคนนี้จะเข้าระบบไม่ได้ทันที ใบจ่ายที่เคยบันทึกยังอยู่ครบ เปิดบัญชีกลับได้ภายหลัง" : "คนขับคนนี้จะเข้าระบบได้อีกครั้งด้วยเบอร์โทรและ PIN เดิม"}</p>
            {msg && <p role="alert" className="text-repair">{msg}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close}>
                ยกเลิก
              </Button>
              <Button variant={target.active ? "danger" : "primary"} disabled={busy} onClick={() => run(() => setDriverActiveAction(target.id, !target.active), (r) => finish(r.message ?? ""))}>
                {target.active ? "ปิดบัญชี" : "เปิดบัญชี"}
              </Button>
            </div>
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog open={!!pin} title={`PIN ของ ${pin?.name ?? ""}`} onClose={() => setPin(null)}>
        {pin && (
          <>
            <p>
              เบอร์โทร <strong>{showPhone(pin.phone)}</strong>
            </p>
            <p className="rounded-control bg-safety-soft px-4 py-3 text-center font-display text-[40px] font-semibold tracking-[0.2em]" data-testid="driver-pin">
              {pin.pin}
            </p>
            <p className="text-muted">จด PIN นี้ไปบอกคนขับตอนนี้ ปิดหน้าต่างแล้วจะดูอีกไม่ได้ ถ้าหายให้กดตั้ง PIN ใหม่</p>
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setPin(null)}>จดแล้ว ปิด</Button>
            </div>
          </>
        )}
      </ConfirmDialog>
      {done && <Toast key={done.n}>{done.text}</Toast>}
    </section>
  );
}

function DriverForm({ driver, onDone, onCancel }: { driver?: Driver; onDone: (r: Answer, d: { name: string; phone: string }) => void; onCancel: () => void }) {
  const [name, setName] = useState(driver?.name ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [err, setErr] = useState<Errors>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const save = (e: { preventDefault(): void }) => {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      try {
        const r: Answer = driver ? await updateDriverAction(driver.id, { name, phone }) : await createDriverAction({ name, phone });
        if (r.ok) return onDone(r, { name: name.trim(), phone: phone.replace(/\D/g, "") });
        setErr(r.errors ?? {});
        if (!r.errors) setMsg(r.message ?? "บันทึกไม่ได้");
      } catch {
        setMsg("บันทึกไม่ได้ ลองอีกครั้ง");
      }
    });
  };

  return (
    <Card className="w-full p-6 lg:w-[380px]">
      <form role="form" aria-label={driver ? "แก้ไขคนขับ" : "เพิ่มคนขับ"} onSubmit={save} className="flex flex-col gap-4" noValidate>
        <CardTitle>{driver ? `แก้ไขคนขับ ${driver.name}` : "เพิ่มคนขับ"}</CardTitle>
        <Field label="ชื่อ นามสกุล" htmlFor="dr-name" error={err.name && <span role="alert">{err.name}</span>}>
          <input id="dr-name" className={`${fieldClass} ${err.name ? fieldBadClass : ""}`} value={name} maxLength={100} autoFocus onChange={(e) => (setName(e.target.value), setErr((x) => ({ ...x, name: undefined })))} />
        </Field>
        <Field label="เบอร์มือถือ" htmlFor="dr-phone" error={err.phone && <span role="alert">{err.phone}</span>} hint="ใช้เป็นชื่อเข้าระบบ 10 หลัก ขึ้นต้นด้วย 0">
          <input id="dr-phone" type="tel" inputMode="tel" className={`${fieldClass} ${err.phone ? fieldBadClass : ""}`} value={phone} maxLength={20} placeholder="08x-xxx-xxxx" onChange={(e) => (setPhone(e.target.value), setErr((x) => ({ ...x, phone: undefined })))} />
        </Field>
        {!driver && <p className="text-[14px] text-muted">กดเพิ่มแล้วระบบจะออก PIN 6 หลักและแสดงให้เห็นครั้งเดียว</p>}
        {msg && <p role="alert" className="text-sm text-repair">{msg}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {driver ? "บันทึก" : "เพิ่มคนขับ"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
