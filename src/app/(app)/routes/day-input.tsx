"use client";

import { useEffect, useRef } from "react";

const WAIT_MS = 800;
// a year still being typed ("0002-…") is not a day to load yet
const isDay = (v: string) => /^(19|20)\d{2}-\d{2}-\d{2}$/.test(v);

/**
 * the day box of /routes: a changed day loads by itself (no "ดู" press), so the add form below always plans the day on screen.
 * It waits until the typing / arrow keys stop for a moment, or the box is left — a day typed digit by digit is never loaded half-way.
 */
export function DayInput({ date }: { date: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const load = (el: HTMLInputElement) => {
    clearTimeout(timer.current);
    if (isDay(el.value) && el.value !== date) el.form?.requestSubmit();
  };

  return (
    <input
      type="date"
      name="date"
      defaultValue={date}
      className="min-h-11 rounded-control border border-idle bg-card px-3"
      onChange={(e) => {
        const el = e.currentTarget;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => load(el), WAIT_MS);
      }}
      onBlur={(e) => load(e.currentTarget)}
    />
  );
}
