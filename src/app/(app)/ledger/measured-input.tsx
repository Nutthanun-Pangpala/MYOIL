"use client";

import { useState, useTransition } from "react";
import { formatBaht } from "@/lib/format";
import { saveStockCheckAction } from "./actions";

const toNum = (s: string): number | null => {
  const t = s.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** "วัดได้จริง" of one day — optional; saved when the box loses focus */
export function MeasuredInput({ date, label, value }: { date: string; label: string; value: number | null }) {
  const [text, setText] = useState(value === null ? "" : formatBaht(value));
  const [pending, start] = useTransition();
  const [bad, setBad] = useState(false);

  function commit() {
    const n = toNum(text);
    if (text.trim() && n === null) return setBad(true);
    setBad(false);
    if (n === value) return;
    setText(n === null ? "" : formatBaht(n));
    start(async () => {
      const res = await saveStockCheckAction({ date, liters: n });
      if (!res.ok) setBad(true);
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
    <input
      aria-label={label}
      aria-invalid={bad || undefined}
      inputMode="decimal"
      value={text}
      disabled={pending}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={`h-11 md:h-9 w-[110px] rounded-lg border bg-card px-3 text-right text-[14px] tabular-nums ${bad ? "border-repair" : "border-idle"}`}
    />
      {bad && (
        <span role="alert" className="text-[13px] text-repair">
          ใส่เป็นตัวเลข ยังไม่ได้บันทึก
        </span>
      )}
    </div>
  );
}
