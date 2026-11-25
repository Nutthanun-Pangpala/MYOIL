"use client";

import { useActionState, useState } from "react";
import { login } from "./actions";

const box = "box-border h-[52px] w-full rounded-control bg-card text-base text-ink";
const border = (bad: boolean) => (bad ? "border-2 border-repair" : "border-[1.5px] border-idle");

/** design 6.1: own messages for empty fields (no browser bubbles), a red box for a refused login, show/hide password */
export function LoginForm({ contact }: { contact: string | null }) {
  const [state, action, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [empty, setEmpty] = useState<{ email?: string; password?: string }>({});

  function check(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const next = {
      email: !email ? "กรอกอีเมลก่อน" : !email.includes("@") ? "อีเมลต้องมี @ เช่น ชื่อ@uwork999.com" : undefined,
      password: !password ? "กรอกรหัสผ่านก่อน" : undefined,
    };
    setEmpty(next);
    if (next.email || next.password) {
      e.preventDefault();
      (e.currentTarget.elements.namedItem(next.email ? "email" : "password") as HTMLInputElement | null)?.focus();
    }
  }

  return (
    <form action={action} onSubmit={check} noValidate className="flex flex-col gap-5">
      {/* OBS-24: a new element per attempt, so a screen reader says it again on the second wrong try */}
      {state?.error && (
        <div key={state.at} role="alert" className="flex items-start gap-2.5 rounded-control border border-repair bg-repair-soft px-3.5 py-3 text-repair-ink">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <path d="M12 4l9 16H3z" />
            <path d="M12 10v4M12 17v.5" />
          </svg>
          <span>{state.error}</span>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[15px]">
          อีเมล
        </label>
        {/* OBS-23: ready to type at once. A refused login keeps the email (React empties a form after its action) and puts the cursor in the password */}
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus={!state?.error}
          defaultValue={state?.email ?? ""}
          key={state?.at}
          aria-invalid={!!empty.email || undefined}
          aria-describedby={empty.email ? "email-err" : undefined}
          onChange={() => empty.email && setEmpty((x) => ({ ...x, email: undefined }))}
          className={`${box} ${border(!!empty.email)} px-3.5`}
        />
        {empty.email && (
          <span id="email-err" role="alert" className="text-sm text-repair-ink">
            {empty.email}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[15px]">
          รหัสผ่าน
        </label>
        <div className={`${box} ${border(!!empty.password)} flex items-center`}>
          <input
            id="password"
            key={state?.at}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            autoFocus={!!state?.error}
            aria-invalid={!!empty.password || undefined}
            aria-describedby={empty.password ? "password-err" : undefined}
            onChange={() => empty.password && setEmpty((x) => ({ ...x, password: undefined }))}
            className="h-12 min-w-0 flex-auto rounded-control border-0 bg-transparent px-3.5 text-base text-ink outline-none"
          />
          {/* OBS-21: see what was typed on a phone instead of retyping it all */}
          <button
            type="button"
            aria-controls="password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((s) => !s)}
            className="h-12 min-w-[60px] flex-none rounded-r-control px-3.5 text-[15px] text-earth underline hover:text-ink"
          >
            {showPassword ? "ซ่อน" : "แสดง"}
          </button>
        </div>
        {empty.password && (
          <span id="password-err" role="alert" className="text-sm text-repair-ink">
            {empty.password}
          </span>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-[52px] rounded-control border border-safety-line bg-safety font-display text-[17px] font-medium text-ink shadow-[0_3px_0_var(--color-safety-deep)] hover:brightness-95 disabled:cursor-wait disabled:border-line disabled:bg-line disabled:text-gray-ink disabled:shadow-none"
      >
        {pending ? "กำลังเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
      </button>
      <p className="text-sm text-muted">ลืมรหัสผ่าน ติดต่อผู้ดูแลระบบ{contact ? ` ${contact}` : ""}</p>
      <a href="/login/driver" className="flex min-h-[48px] items-center justify-center rounded-control border-[1.5px] border-ink bg-card font-display text-base font-medium text-ink no-underline">
        คนขับรถเติมน้ำมัน เข้าด้วยเบอร์โทร
      </a>
    </form>
  );
}
