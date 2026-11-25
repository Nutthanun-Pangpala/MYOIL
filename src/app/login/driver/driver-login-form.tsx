"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { forgetDriver, loginDriver } from "./actions";

/** 0811111111 → 081-111-1111 */
const formatPhone = (d: string) => (d.length <= 3 ? d : d.length <= 6 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}`);
const masked = (d: string) => `${d.slice(0, 3)}-•••-${d.slice(6)}`;
const digitsOf = (s: string) => s.replace(/\D/g, "").slice(0, 10);

const key =
  "flex h-[60px] flex-1 items-center justify-center rounded-[14px] border border-line bg-card font-display text-[28px] font-medium text-ink shadow-[0_3px_0_var(--color-line)] active:translate-y-[2px] active:bg-safety-soft active:shadow-none";
const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];
const glow = "border-safety-line shadow-[0_0_0_4px_var(--color-safety-soft)]";

/**
 * The driver's login, made as easy as BookCare's (owner, 25 Nov 2026):
 *  - everything is pressed on one big keypad — no phone keyboard pops up, gloves are fine;
 *  - 10 digits of the phone → the cursor moves to the PIN by itself; the 6th PIN digit logs in, no button;
 *  - the phone is remembered on this device, so the next login is "สวัสดีครับ คุณ…" + the PIN only;
 *  - one line under the boxes always says what to do next or what went wrong; a refused PIN clears itself.
 * A computer's number keys and Backspace work too.
 */
export function DriverLoginForm({ remembered, contact }: { remembered: { phone: string; name: string } | null; contact: string | null }) {
  const [state, action, pending] = useActionState(loginDriver, undefined);
  const [known, setKnown] = useState(remembered);
  const [phone, setPhone] = useState(remembered?.phone ?? "");
  const [pin, setPin] = useState("");
  const [focus, setFocus] = useState<"phone" | "pin">(remembered ? "pin" : "phone");
  const [hint, setHint] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [help, setHelp] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // log in by itself only after the driver really pressed a digit — never again on a returned error
  const armed = useRef(false);
  const lockedUntil = state?.locked && state.at ? state.at + state.locked * 60_000 : 0;

  // a refused try: the PIN empties, the phone stays, the box shakes; a phone problem sends the cursor back to the phone
  useEffect(() => {
    if (!state) return;
    setPin("");
    setShake((n) => n + 1);
    if (state.phone !== undefined) setPhone(digitsOf(state.phone));
    if (state.field === "phone") {
      setKnown(null);
      setFocus("phone");
    } else setFocus("pin");
  }, [state]);

  // PIN complete → log in, no extra button
  useEffect(() => {
    if (armed.current && pin.length === 6 && phone.length === 10 && !pending) {
      armed.current = false;
      formRef.current?.requestSubmit();
    }
  }, [pin, phone, pending]);

  function digit(d: string) {
    setHint(null);
    if (pending) return;
    if (focus === "phone") {
      if (phone.length === 0 && d !== "0") return setHint("เบอร์มือถือขึ้นต้นด้วย 0");
      const next = (phone + d).slice(0, 10);
      setPhone(next);
      if (next.length === 10) setFocus("pin");
    } else if (Date.now() >= lockedUntil) {
      armed.current = true;
      setPin((p) => (p.length < 6 ? p + d : p));
    }
  }
  function del() {
    setHint(null);
    if (focus === "pin" && pin.length > 0) setPin((p) => p.slice(0, -1));
    else if (focus === "pin" && !known) setFocus("phone");
    else if (focus === "phone") setPhone((p) => p.slice(0, -1));
  }
  function toPin() {
    if (phone.length < 10) return setHint(`เบอร์ยังไม่ครบ (${phone.length}/10 หลัก)`);
    setFocus("pin");
  }

  // number keys of a computer
  const press = useRef({ digit, del });
  useEffect(() => {
    press.current = { digit, del };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press.current.digit(e.key);
      else if (e.key === "Backspace") press.current.del();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pinError = state?.error && state.field !== "phone" ? state.error : null;
  const phoneError = state?.error && state.field === "phone" ? state.error : null;
  const phoneDone = phone.length === 10;
  const message = pending
    ? { text: "กำลังเข้าสู่ระบบ", bad: false }
    : hint
      ? { text: hint, bad: false }
      : phoneError && focus === "phone"
        ? { text: phoneError, bad: true }
        : pinError && pin.length === 0
          ? { text: pinError, bad: true }
          : focus === "phone"
            ? { text: "กดตัวเลขด้านล่าง ครบ 10 หลักแล้วไปที่ PIN เอง", bad: false }
            : { text: "ใส่ PIN ครบ 6 หลัก ระบบเข้าให้เอง", bad: false };

  return (
    <form ref={formRef} action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="pin" value={pin} />

      <main className="flex flex-1 flex-col gap-[12px] px-[16px] pb-[16px] pt-[14px]">
        <h1 className="font-display text-[24px] font-semibold leading-[1.3]">{known ? `สวัสดีครับ คุณ${known.name.split(" ")[0]}` : "เข้าสู่ระบบ"}</h1>

        {/* step 1 — the phone: big slots while typing, one line once it is in */}
        {known || (phoneDone && focus === "pin") ? (
          <div className="flex items-center gap-[12px] rounded-[16px] border border-line bg-card px-[16px] py-[10px]" data-testid="phone-done">
            <span aria-hidden="true" className="grid size-[26px] shrink-0 place-items-center rounded-full bg-working text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[14px] text-muted">เบอร์โทร</span>
              <span className="font-display text-[20px] font-semibold tracking-wide">{known ? masked(known.phone) : formatPhone(phone)}</span>
            </span>
            {known ? (
              <button
                type="button"
                onClick={async () => {
                  setKnown(null);
                  setPhone("");
                  setPin("");
                  setFocus("phone");
                  await forgetDriver();
                }}
                className="min-h-[44px] px-[4px] text-[15px] text-earth underline"
              >
                ไม่ใช่ฉัน ใช้เบอร์อื่น
              </button>
            ) : (
              <button type="button" onClick={() => setFocus("phone")} className="min-h-[44px] px-[8px] text-[15px] text-earth underline">
                เปลี่ยน
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFocus("phone")}
            aria-label={`เบอร์โทร ${phone ? formatPhone(phone) : "ยังไม่ได้ใส่"}`}
            data-testid="phone-box"
            className={`flex flex-col gap-[8px] rounded-[16px] border-2 bg-card px-[16px] pb-[14px] pt-[10px] text-left ${phoneError && !hint ? "border-repair" : focus === "phone" ? glow : "border-idle"}`}
          >
            <span className="flex items-center justify-between">
              <span className="text-[15px]">เบอร์โทร</span>
              <span className="text-[14px] text-muted">{phone.length}/10</span>
            </span>
            <span className="flex items-end justify-center gap-[10px]" aria-hidden="true">
              {[
                [0, 3],
                [3, 6],
                [6, 10],
              ].map(([a, b]) => (
                <span key={a} className="flex items-end gap-[4px]">
                  {Array.from({ length: b - a }, (_, n) => {
                    const i = a + n;
                    const ch = phone[i];
                    const cursor = focus === "phone" && i === phone.length;
                    return (
                      <span key={i} className="flex w-[24px] flex-col items-center gap-[3px]">
                        <span className={`h-[36px] font-display text-[30px] font-semibold leading-[36px] ${ch ? "text-ink" : "text-transparent"}`}>{ch ?? "0"}</span>
                        <span className={`h-[3px] w-full rounded-full ${cursor ? "animate-pulse bg-safety-deep motion-reduce:animate-none" : ch ? "bg-ink" : "bg-line"}`} />
                      </span>
                    );
                  })}
                </span>
              ))}
            </span>
          </button>
        )}

        {/* step 2 — the PIN */}
        <button
          type="button"
          key={shake}
          onClick={toPin}
          aria-label={`PIN ใส่แล้ว ${pin.length} จาก 6 หลัก`}
          data-testid="pin-boxes"
          className={`flex flex-col gap-[8px] rounded-[16px] border-2 bg-card px-[16px] pb-[14px] pt-[10px] text-left ${shake && pinError ? "shake" : ""} ${pinError && pin.length === 0 ? "border-repair" : focus === "pin" ? glow : "border-idle opacity-60"}`}
        >
          <span className="text-[15px]">PIN 6 หลัก</span>
          <span className="flex justify-between gap-[6px]" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => {
              const filled = i < pin.length;
              const current = focus === "pin" && i === pin.length;
              return (
                <span key={i} className={`flex h-[52px] w-[44px] items-center justify-center rounded-[14px] border-2 bg-card ${filled || current ? "border-earth" : pinError && pin.length === 0 ? "border-repair" : "border-idle"}`}>
                  {filled ? <span className="size-[14px] rounded-full bg-ink" /> : current ? <span className="h-[24px] w-[2px] animate-pulse bg-earth motion-reduce:animate-none" /> : null}
                </span>
              );
            })}
          </span>
        </button>

        <p role={message.bad ? "alert" : "status"} data-testid="login-message" className={`min-h-[44px] text-center text-[15px] leading-snug ${message.bad ? "text-repair-ink" : "text-muted"}`}>
          {message.text}
        </p>

        <div className="flex w-full flex-col gap-[8px]">
          {ROWS.map((row) => (
            <div key={row[0]} className="flex gap-[8px]">
              {row.map((d) => (
                <button key={d} type="button" className={key} onClick={() => digit(d)}>
                  {d}
                </button>
              ))}
            </div>
          ))}
          <div className="flex gap-[8px]">
            <span className="flex-1" aria-hidden="true" />
            <button type="button" className={key} onClick={() => digit("0")}>
              0
            </button>
            <button type="button" aria-label="ลบตัวสุดท้าย" className={key} onClick={del}>
              <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6h11v12H9l-6-6z" />
                <path d="M12 10l4 4M16 10l-4 4" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      <div className="flex flex-col gap-[8px] border-t border-line bg-card px-[16px] pb-[max(22px,env(safe-area-inset-bottom))] pt-[10px]">
        <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} className="min-h-[44px] text-[15px] text-earth underline">
          ลืม PIN หรือเข้าไม่ได้
        </button>
        {help && (
          <p className="rounded-[14px] bg-page px-[14px] py-[12px] text-[15px] leading-relaxed">
            ติดต่อผู้ดูแลระบบ MYOIL{contact ? ` ${contact}` : ""} ให้ตั้ง PIN ใหม่ให้ ใช้ได้ทันที ถ้าใส่ผิดเกิน 5 ครั้ง ระบบพักบัญชี 5 นาทีแล้วลองใหม่ได้เอง
          </p>
        )}
        <a href="/login" className="flex min-h-[48px] items-center justify-center rounded-[14px] border-[1.5px] border-line bg-card text-[15px] text-earth no-underline">
          พนักงานออฟฟิศ เข้าด้วยอีเมล
        </a>
      </div>
    </form>
  );
}
