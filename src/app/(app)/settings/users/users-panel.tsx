"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Toast } from "@/components/toast";
import { Button, Card, CardTitle, Field, Pill, ProjectChip, fieldBadClass, fieldClass } from "@/components/ui";
import { roleLabel, type Role } from "@/lib/labels";
import { createUserAction, resetPasswordAction, setUserActiveAction, updateUserAction } from "../actions";
import { SettingsHeader } from "../settings-header";

type User = { id: string; name: string; email: string; role: Role; active: boolean; projects: { id: string; ref: string }[] };
type Project = { id: string; ref: string; name: string };
type Errors = Partial<Record<"name" | "email" | "role" | "projects" | "password", string>>;
type Mode = { kind: "add" } | { kind: "edit"; id: string } | { kind: "reset"; id: string } | { kind: "toggle"; id: string } | null;

const ROLES: Role[] = ["project_viewer", "store_admin", "executive", "system_admin"];
const rowLink = "min-h-11 whitespace-nowrap px-1 text-earth underline hover:text-ink";
const bad = (e?: string) => (e ? fieldBadClass : "");

/** design 6.11 ผู้ใช้: the list on the left, the add / edit form beside it, reset and close-account ask in a window */
export function UsersPanel({ users, projects, meId }: { users: User[]; projects: Project[]; meId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [done, setDone] = useState<{ n: number; text: string } | null>(null);
  const target = mode && mode.kind !== "add" ? users.find((u) => u.id === mode.id) : undefined;
  const ok = (text: string) => {
    setMode(null);
    setDone((d) => ({ n: (d?.n ?? 0) + 1, text }));
    router.refresh();
  };
  const close = () => setMode(null);

  return (
    <>
      <SettingsHeader actions={<Button onClick={() => setMode({ kind: "add" })}>เพิ่มผู้ใช้</Button>} />
      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-6">
          <div className="overflow-x-auto">
            <table className="t">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>อีเมล</th>
                  <th>บทบาท</th>
                  <th>โครงการที่ดูแล</th>
                  <th>สถานะ</th>
                  <th>
                    <span className="sr-only">จัดการ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.name}</td>
                    <td>{u.email}</td>
                    <td>{roleLabel[u.role]}</td>
                    <td>
                      {u.role === "project_viewer" ? (
                        u.projects.length ? (
                          <span className="flex flex-wrap gap-1.5">
                            {u.projects.map((p) => (
                              <ProjectChip key={p.id} code={p.ref} />
                            ))}
                          </span>
                        ) : (
                          <span className="text-muted">ยังไม่ได้เลือก</span>
                        )
                      ) : u.role === "executive" ? (
                        "ทุกโครงการ อ่านอย่างเดียว"
                      ) : (
                        "ทุกโครงการ"
                      )}
                    </td>
                    <td>
                      <Pill tone={u.active ? "ok" : "off"}>{u.active ? "ใช้งานอยู่" : "ปิดบัญชีแล้ว"}</Pill>
                    </td>
                    <td className="whitespace-nowrap">
                      <button type="button" className={rowLink} onClick={() => setMode({ kind: "edit", id: u.id })}>
                        แก้ไข
                      </button>{" "}
                      <button type="button" className={rowLink} onClick={() => setMode({ kind: "reset", id: u.id })}>
                        รีเซ็ตรหัสผ่าน
                      </button>{" "}
                      {(u.active ? u.id !== meId : true) && (
                        <button type="button" className={rowLink} onClick={() => setMode({ kind: "toggle", id: u.id })}>
                          {u.active ? "ปิดบัญชี" : "เปิดบัญชี"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[14px] text-muted">ไม่มีการสมัครเอง ผู้ดูแลระบบสร้างบัญชีให้ทุกคน รีเซ็ตรหัสผ่านและปิดบัญชีต้องยืนยันก่อน</p>
        </Card>

        {mode?.kind === "add" && <UserForm key="add" projects={projects} onDone={ok} onCancel={close} />}
        {mode?.kind === "edit" && target && <UserForm key={target.id} user={target} projects={projects} onDone={ok} onCancel={close} />}
      </div>

      <ConfirmDialog open={mode?.kind === "reset" && !!target} title={`รีเซ็ตรหัสผ่านของ ${target?.name ?? ""} ใช่ไหม`} onClose={close}>
        {target && <ResetBox user={target} onDone={ok} onCancel={close} />}
      </ConfirmDialog>
      <ConfirmDialog open={mode?.kind === "toggle" && !!target} title={`${target?.active ? "ปิดบัญชี" : "เปิดบัญชี"}ของ ${target?.name ?? ""} ใช่ไหม`} onClose={close}>
        {target && <ToggleBox user={target} onDone={ok} onCancel={close} />}
      </ConfirmDialog>
      {done && <Toast key={done.n}>{done.text}</Toast>}
    </>
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

function Problem({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="alert" className="text-[14px] text-repair">
      {msg}
    </p>
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
  const viewer = role === "project_viewer";

  function save() {
    const body = { name, email, role, projectIds: picked, password };
    run(() => (user ? updateUserAction(user.id, body) : createUserAction(body)), onDone, setErr);
  }

  return (
    <div role="form" aria-label={user ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"} className="min-w-0 flex-[1_1_340px]">
      <Card className="flex flex-col gap-4 p-6">
        <CardTitle>{user ? `แก้ไขผู้ใช้ ${user.name}` : "เพิ่มผู้ใช้"}</CardTitle>
        <Field label="ชื่อ" htmlFor="su-name" error={err.name}>
          <input id="su-name" className={`${fieldClass} ${bad(err.name)}`} value={name} onChange={(e) => (setName(e.target.value), clear("name"))} />
        </Field>
        <Field label="อีเมล" htmlFor="su-mail" error={err.email} hint={user ? "อีเมลใช้เข้าสู่ระบบ แก้ไม่ได้" : undefined}>
          <input
            id="su-mail"
            type="email"
            className={`${fieldClass} ${bad(err.email)} disabled:bg-page disabled:text-muted`}
            value={email}
            disabled={!!user}
            onChange={(e) => (setEmail(e.target.value), clear("email"))}
          />
        </Field>
        <Field label="บทบาท" htmlFor="su-role">
          <select id="su-role" className={fieldClass} value={role} onChange={(e) => (setRole(e.target.value as Role), clear("projects"))}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="flex min-w-0 flex-col gap-1.5">
          <legend className="mb-1.5 text-sm">โครงการที่ดูแล</legend>
          {viewer && (
            <>
              <input
                type="search"
                aria-label="ค้นหาโครงการ"
                placeholder="พิมพ์รหัสโครงการ เลือกได้หลายโครงการ"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={`${fieldClass} ${bad(err.projects)}`}
              />
              <div className="flex max-h-52 flex-col overflow-y-auto rounded-control border border-line">
                {shown.map((p) => (
                  <label key={p.id} className="flex min-h-11 items-center gap-3 border-b border-line px-3 last:border-b-0">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={picked.includes(p.id)}
                      onChange={() => (setPicked((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id])), clear("projects"))}
                    />
                    <span className="font-medium">{p.ref}</span>
                    <span className="truncate text-muted">{p.name}</span>
                  </label>
                ))}
                {shown.length === 0 && <p className="p-3 text-muted">ไม่พบโครงการ</p>}
              </div>
              {err.projects && <span className="text-[13px] text-repair">{err.projects}</span>}
            </>
          )}
          <span className="text-[13px] text-muted">{viewer ? `ใช้กับบทบาทผู้ดูโครงการเท่านั้น เลือกแล้ว ${picked.length} โครงการ` : "ใช้กับบทบาทผู้ดูโครงการเท่านั้น บทบาทนี้เห็นทุกโครงการ"}</span>
        </fieldset>
        {!user && (
          <Field label="รหัสผ่านเริ่มต้น" htmlFor="su-pass" error={err.password} hint="อย่างน้อย 8 ตัวอักษร แจ้งให้ผู้ใช้เอง ระบบไม่ส่งอีเมลให้">
            <input
              id="su-pass"
              type="password"
              autoComplete="new-password"
              className={`${fieldClass} ${bad(err.password)}`}
              value={password}
              onChange={(e) => (setPassword(e.target.value), clear("password"))}
            />
          </Field>
        )}
        {errCount > 0 && (
          <p role="alert" className="text-[14px] text-repair">
            แก้ {errCount} จุดที่ขึ้นสีแดงก่อน
          </p>
        )}
        <Problem msg={msg} />
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" disabled={busy} onClick={save}>
            {user ? "บันทึก" : "เพิ่มผู้ใช้"}
          </Button>
          <Button onClick={onCancel}>ยกเลิก</Button>
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
    <section aria-label="รีเซ็ตรหัสผ่าน" className="flex flex-col gap-4">
      <p>รหัสผ่านเดิมของผู้ใช้นี้จะใช้ไม่ได้ทันที ผู้ใช้ต้องเข้าด้วยรหัสผ่านใหม่ที่ตั้งด้านล่าง</p>
      <Field label="รหัสผ่านใหม่" htmlFor="dlg-pass" error={err.password} hint="แจ้งรหัสผ่านใหม่ให้ผู้ใช้เอง ระบบไม่ส่งอีเมลให้">
        <input
          id="dlg-pass"
          type="password"
          autoComplete="new-password"
          className={`${fieldClass} ${bad(err.password)}`}
          value={pw}
          onChange={(e) => (setPw(e.target.value), setErr({}))}
          autoFocus
        />
      </Field>
      <Problem msg={msg} />
      <div className="flex flex-wrap justify-end gap-3 pt-1">
        <Button onClick={onCancel}>ไม่รีเซ็ต</Button>
        <Button variant="primary" disabled={busy} onClick={() => run(() => resetPasswordAction(user.id, pw), () => onDone(`รีเซ็ตรหัสผ่านของ ${user.name} แล้ว`), setErr)}>
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
    <section aria-label={off ? "ปิดบัญชี" : "เปิดบัญชี"} className="flex flex-col gap-4">
      {off ? (
        <>
          <p>ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้ทันที ใบจ่ายและประวัติการแก้ไขที่เขาเคยบันทึกยังอยู่ครบ</p>
          <p className="text-[14px] text-muted">เปิดบัญชีคืนได้จากหน้านี้ทุกเมื่อ</p>
        </>
      ) : (
        <p>ผู้ใช้นี้จะเข้าสู่ระบบได้อีกครั้งด้วยรหัสผ่านเดิม</p>
      )}
      <Problem msg={msg} />
      <div className="flex flex-wrap justify-end gap-3 pt-1">
        <Button onClick={onCancel}>{off ? "ไม่ปิด" : "ไม่เปิด"}</Button>
        <Button variant={off ? "danger" : "primary"} disabled={busy} onClick={() => run(() => setUserActiveAction(user.id, !off), () => onDone(`${off ? "ปิด" : "เปิด"}บัญชีของ ${user.name} แล้ว`))}>
          {off ? "ปิดบัญชี" : "เปิดบัญชี"}
        </Button>
      </div>
    </section>
  );
}
