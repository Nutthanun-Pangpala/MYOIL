"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[14px]">
        อีเมล
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="h-11 rounded-control border border-line bg-card px-3 text-[15px]"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[14px]">
        รหัสผ่าน
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 rounded-control border border-line bg-card px-3 text-[15px]"
        />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-control bg-repair-soft px-3 py-2 text-[14px] text-repair">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </Button>
      <p className="text-[13px] text-muted">ลืมรหัสผ่าน ติดต่อผู้ดูแลระบบ</p>
    </form>
  );
}
