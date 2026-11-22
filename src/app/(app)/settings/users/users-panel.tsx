"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { roleLabel, type Role } from "@/lib/labels";
import { createUserAction, resetPasswordAction, setUserActiveAction, updateUserAction } from "../actions";

type User = { id: string; name: string; email: string; role: Role; active: boolean; projects: { id: string; ref: string }[] };
type Project = { id: string; ref: string; name: string };
type Errors = Partial<Record<"name" | "email" | "role" | "projects" | "password", string>>;
type Mode = { kind: "add" } | { kind: "edit"; id: string } | { kind: "reset"; id: string } | { kind: "toggle"; id: string } | null;

const field = "h-11 w-full rounded-control border border-line bg-card px-3 text-[15px]";
const ROLES: Role[] = ["project_viewer", "store_admin", "executive", "system_admin"];

export function UsersPanel({ users, projects, meId }: { users: User[]; projects: Project[]; meId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [toast, setToast] = useState<string | null>(null);
  const target = mode && mode.kind !== "add" ? users.find((u) => u.id === mode.id) : undefined;
  const ok = (text: string) => {
    setMode(null);
    setToast(text);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px]">ไม่มีการสมัครเอง ผู้ดูแลระบบสร้างบัญชีให้ทุกคน รีเซ็ตรหัสผ่านและปิดบัญชีต้องยืนยันก่อน</p>
        <Button variant="primary" onClick={() => (setToast(null), setMode({ kind: "add" }))}>
          เพิ่มผู้ใช้
        </Button>
      </div>
      {toast && (
        <p role="status" className="rounded-control bg-working-soft px-3 py-2 text-[14px] text-working">
          {toast}
        </p>
      )}

      {mode?.kind === "add" && <UserForm key="add" projects={projects} onDone={ok} onCancel={() => setMode(null)} />}
      {mode?.kind === "edit" && target && <UserForm key={target.id} user={target} projects={projects} onDone={ok} onCancel={() => setMode(null)} />}
      {mode?.kind === "reset" && target && <ResetBox user={target} onDone={ok} onCancel={() => setMode(null)} />}
      {mode?.kind === "toggle" && target && <ToggleBox user={target} onDone={ok} onCancel={() => setMode(null)} />}

      <Card className="overflow-x-auto p-2">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="text-left text-muted">
              {["ชื่อ", "อีเมล", "บทบาท", "โครงการที่ดูแล", "สถานะ", "จัดการ"].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line align-top">
                <td className="px-3 py-3 font-medium">{u.name}</td>
                <td className="px-3 py-3">{u.email}</td>
                <td className="px-3 py-3">{roleLabel[u.role]}</td>
                <td className="px-3 py-3">{u.role === "project_viewer" ? u.projects.map((p) => p.ref).join(", ") || "ยังไม่ได้เลือก" : u.role === "executive" ? "ทุกโครงการ อ่านอย่างเดียว" : "ทุกโครงการ"}</td>
                <td className="px-3 py-3">
                  <Pill tone={u.active ? "ok" : "bad"}>{u.active ? "ใช้งานอยู่" : "ปิดบัญชีแล้ว"}</Pill>
                </td>
                <td className="px-3 py-3">
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    <button type="button" className="text-earth underline" onClick={() => (setToast(null), setMode({ kind: "edit", id: u.id }))}>
                      แก้ไข
                    </button>
                    <button type="button" className="text-earth underline" onClick={() => (setToast(null), setMode({ kind: "reset", id: u.id }))}>
                      รีเซ็ตรหัสผ่าน
                    </button>
                    {(u.active ? u.id !== meId : true) && (
                      <button type="button" className="text-earth underline" onClick={() => (setToast(null), setMode({ kind: "toggle", id: u.id }))}>
                        {u.active ? "ปิดบัญชี" : "เปิดบัญชี"}
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function useRun() {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string; errors?: Errors }>, onOk: (m: string) => void, onErrors?: (e: Errors) => void) => {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) onOk(r.message ?? "บันทึกแล้ว");
        else {
          if (r.errors) onErrors?.(r.errors);
          if (!r.errors) setMsg(r.message ?? "ทำไม่สำเร็จ");
        }
      } catch {
        setMsg("ทำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      }
    });
  };
  return { busy, msg, run };
}

function Err({ m }: { m?: string }) {
  return m ? (
    <span role="alert" className="block text-[13px] text-repair">
      {m}
    </span>
  ) : null;
}

function UserForm({ user, projects, onDone, onCancel }: { user?: User; projects: Project[]; onDone: (m: string) => void; onCancel: () => void }) {
  const { busy, msg, run } = useRun();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "project_viewer");
  const [picked, setPicked] = useState<string[]>(user?.projects.map((p) => p.id) ?? []);
  const [password, setPassword] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<Errors>({});
  const clear = (k: keyof Errors) => setErr((e) => ({ ...e, [k]: undefined }));
  const shown = projects.filter((p) => !q.trim() || `${p.ref} ${p.name}`.toLowerCase().includes(q.trim().toLowerCase()));
  const errCount = Object.values(err).filter(Boolean).length;

  function save() {
    const body = { name, email, role, projectIds: picked, password };
    run(() => (user ? updateUserAction(user.id, body) : createUserAction(body)), onDone, setErr);
  }

  return (
    <div role="form" aria-label={user ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"} className="max-w-2xl">
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-display text-xl font-medium">{user ? `แก้ไขผู้ใช้ ${user.name}` : "เพิ่มผู้ใช้"}</h2>
        <label className="text-[14px]">
          ชื่อ
          <input className={`${field} ${err.name ? "border-repair" : ""}`} value={name} onChange={(e) => (setName(e.target.value), clear("name"))} />
          <Err m={err.name} />
        </label>
        <label className="text-[14px]">
          อีเมล
          <input type="email" className={`${field} ${err.email ? "border-repair" : ""} disabled:opacity-60`} value={email} disabled={!!user} onChange={(e) => (setEmail(e.target.value), clear("email"))} />
          <Err m={err.email} />
        </label>
        <label className="text-[14px]">
          บทบาท
          <select className={field} value={role} onChange={(e) => (setRole(e.target.value as Role), clear("projects"))}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className={role === "project_viewer" ? "" : "opacity-50"}>
          <legend className="text-[14px]">โครงการที่ดูแล</legend>
          <p className="text-[13px] text-muted">ใช้กับบทบาทผู้ดูโครงการเท่านั้น</p>
          {role === "project_viewer" && (
            <>
              <input type="search" aria-label="ค้นหาโครงการ" placeholder="ค้นหาโครงการ" value={q} onChange={(e) => setQ(e.target.value)} className={`${field} my-2`} />
              <div className="flex max-h-52 flex-col overflow-y-auto rounded-control border border-line">
                {shown.map((p) => (
                  <label key={p.id} className="flex min-h-11 items-center gap-3 border-b border-line px-3 last:border-b-0">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={picked.includes(p.id)}
                      onChange={() => (setPicked((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id])), clear("projects"))}
                    />
                    <span className="font-medium">{p.ref}</span>
                    <span className="truncate text-muted">{p.name}</span>
                  </label>
                ))}
                {shown.length === 0 && <p className="p-3 text-muted">ไม่พบโครงการ</p>}
              </div>
              <p className="mt-1 text-[13px] text-muted">เลือกแล้ว {picked.length} โครงการ</p>
              <Err m={err.projects} />
            </>
          )}
        </fieldset>
        {!user && (
          <label className="text-[14px]">
            รหัสผ่านเริ่มต้น
            <input className={`${field} ${err.password ? "border-repair" : ""}`} value={password} onChange={(e) => (setPassword(e.target.value), clear("password"))} autoComplete="off" />
            <span className="text-[13px] text-muted">อย่างน้อย 8 ตัวอักษร แจ้งให้ผู้ใช้เอง ระบบไม่ส่งอีเมลให้</span>
            <Err m={err.password} />
          </label>
        )}
        {errCount > 0 && (
          <p role="alert" className="text-[14px] text-repair">
            แก้ {errCount} จุดที่ขึ้นสีแดงก่อน
          </p>
        )}
        {msg && (
          <p role="alert" className="text-[14px] text-repair">
            {msg}
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="primary" disabled={busy} onClick={save}>
            {user ? "บันทึก" : "เพิ่มผู้ใช้"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            ยกเลิก
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ResetBox({ user, onDone, onCancel }: { user: User; onDone: (m: string) => void; onCancel: () => void }) {
  const { busy, msg, run } = useRun();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<Errors>({});
  return (
    <section aria-label="รีเซ็ตรหัสผ่าน" className="flex max-w-xl flex-col gap-3 rounded-card border border-idle bg-card p-5">
      <h2 className="font-display text-xl font-medium">รีเซ็ตรหัสผ่านของ {user.name} ใช่ไหม</h2>
      <p className="text-[14px]">รหัสผ่านเดิมของผู้ใช้นี้จะใช้ไม่ได้ทันที ผู้ใช้ต้องเข้าด้วยรหัสผ่านใหม่ที่ตั้งด้านล่าง</p>
      <label className="text-[14px]">
        รหัสผ่านใหม่
        <input className={`${field} ${err.password ? "border-repair" : ""}`} value={pw} onChange={(e) => (setPw(e.target.value), setErr({}))} autoComplete="off" autoFocus />
        <span className="text-[13px] text-muted">แจ้งรหัสผ่านใหม่ให้ผู้ใช้เอง ระบบไม่ส่งอีเมลให้</span>
        <Err m={err.password} />
      </label>
      {msg && <p role="alert" className="text-[14px] text-repair">{msg}</p>}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onCancel}>
          ไม่รีเซ็ต
        </Button>
        <Button disabled={busy} onClick={() => run(() => resetPasswordAction(user.id, pw), () => onDone(`รีเซ็ตรหัสผ่านของ ${user.name} แล้ว`), setErr)}>
          รีเซ็ตรหัสผ่าน
        </Button>
      </div>
    </section>
  );
}

function ToggleBox({ user, onDone, onCancel }: { user: User; onDone: (m: string) => void; onCancel: () => void }) {
  const { busy, msg, run } = useRun();
  const off = user.active;
  return (
    <section aria-label={off ? "ปิดบัญชี" : "เปิดบัญชี"} className="flex max-w-xl flex-col gap-3 rounded-card border border-repair bg-card p-5">
      <h2 className="font-display text-xl font-medium">
        {off ? "ปิดบัญชี" : "เปิดบัญชี"}ของ {user.name} ใช่ไหม
      </h2>
      <p className="text-[14px]">{off ? "ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้ทันที ใบจ่ายและประวัติการแก้ไขที่เขาเคยบันทึกยังอยู่ครบ เปิดบัญชีคืนได้จากหน้านี้ทุกเมื่อ" : "ผู้ใช้นี้จะเข้าสู่ระบบได้อีกครั้งด้วยรหัสผ่านเดิม"}</p>
      {msg && <p role="alert" className="text-[14px] text-repair">{msg}</p>}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onCancel}>
          {off ? "ไม่ปิด" : "ไม่เปิด"}
        </Button>
        <Button disabled={busy} onClick={() => run(() => setUserActiveAction(user.id, !off), () => onDone(`${off ? "ปิด" : "เปิด"}บัญชีของ ${user.name} แล้ว`))}>
          {off ? "ปิดบัญชี" : "เปิดบัญชี"}
        </Button>
      </div>
    </section>
  );
}
