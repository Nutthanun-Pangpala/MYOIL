"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkButton } from "@/components/ui";
import { syncProjectsAction } from "../actions";

export function SyncButton({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={linkButton()}
        disabled={pending || !configured}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await syncProjectsAction();
            setMsg({ ok: r.ok, text: r.message });
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? "กำลังซิงก์…" : "ซิงก์โครงการจาก BookCare"}
      </button>
      {!configured && <span className="text-[13px] text-muted">ยังไม่ได้เชื่อมต่อ BookCare (ตั้ง BOOKCARE_DATABASE_URL ก่อน)</span>}
      {msg && (
        <span role={msg.ok ? "status" : "alert"} className={`text-[14px] ${msg.ok ? "text-working" : "text-repair"}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
