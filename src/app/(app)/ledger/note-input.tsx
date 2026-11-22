"use client";

import { useState, useTransition } from "react";
import { saveLedgerNoteAction } from "./actions";

/** หมายเหตุ of one day — optional free text; saved when the box loses focus */
export function NoteInput({ date, label, value }: { date: string; label: string; value: string }) {
  const [text, setText] = useState(value);
  const [pending, start] = useTransition();
  const [bad, setBad] = useState(false);

  function commit() {
    if (text.trim() === value.trim()) return;
    setBad(false);
    start(async () => {
      try {
        const r = await saveLedgerNoteAction(date, text);
        if (!r.ok) setBad(true);
      } catch {
        setBad(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      <input
        aria-label={label}
        value={text}
        maxLength={300}
        disabled={pending}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={`h-11 w-[180px] rounded-lg border bg-card px-3 text-[14px] md:h-9 ${bad ? "border-repair" : "border-idle"}`}
      />
      {bad && (
        <span role="alert" className="text-[13px] text-repair">
          บันทึกหมายเหตุไม่สำเร็จ ลองอีกครั้ง
        </span>
      )}
    </div>
  );
}
