"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Shared pieces of the driver's fill screens (design "MYOIL — หน้าจอฝั่ง พขร. (ขั้นที่ 2)", boards Stop … Refill). */

const base = "flex w-full items-center justify-center gap-[10px] rounded-[16px] px-[16px] text-center font-display font-medium no-underline";
export const btnYellow = `${base} min-h-[62px] border border-safety-line bg-safety text-[20px] text-ink shadow-[0_4px_0_var(--color-safety-deep)] disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-gray-ink disabled:shadow-none`;
export const btnLine = `${base} min-h-[58px] border-2 border-earth bg-card text-[18px] text-ink shadow-[0_4px_0_var(--color-line)] disabled:opacity-50`;
export const btnRed = `${base} min-h-[58px] border border-repair-deep bg-repair text-[18px] text-white`;
export const linkBtn = "min-h-[56px] text-earth underline";

const Back = () => (
  <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

/** phone frame of a flow screen: dark title bar with "กลับ", the page, and the dock with its main button */
export function Screen({ title, sub, onBack, backHref, step, dock, dark, children }: { title: string; sub?: ReactNode; onBack?: () => void; backHref?: string; step?: 1 | 2 | 3; dock?: ReactNode; dark?: boolean; children: ReactNode }) {
  const back = "ml-[-12px] flex size-[56px] shrink-0 items-center justify-center rounded-[14px] text-white";
  return (
    <div className={`mx-auto flex min-h-dvh max-w-md flex-col ${dark ? "bg-tank-deep text-white" : "bg-page text-ink"}`}>
      <header className="shrink-0 bg-tank text-white">
        <div className="flex min-h-[64px] items-center gap-[2px] px-[16px] pb-[4px] pt-[max(4px,env(safe-area-inset-top))]">
          {backHref ? (
            <a href={backHref} aria-label="กลับ" className={back}>
              <Back />
            </a>
          ) : (
            <button type="button" aria-label="กลับ" onClick={onBack} className={back}>
              <Back />
            </button>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="font-display text-[21px] font-medium leading-[1.3]">{title}</h1>
            {sub && <span className="text-[14px] leading-[1.4] text-line">{sub}</span>}
          </div>
          {step && (
            <span role="img" aria-label={`ขั้น ${step} จาก 3`} className="flex items-center gap-[5px]">
              {[1, 2, 3].map((n) => (
                <span key={n} className={`h-[8px] rounded-full ${n === step ? "w-[22px] bg-safety" : n < step ? "w-[8px] bg-working" : "w-[8px] bg-white-14"}`} />
              ))}
            </span>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-[14px] p-[16px]">{children}</main>
      {dock && <div className={`sticky bottom-0 flex flex-col gap-[12px] border-t px-[16px] pb-[max(22px,env(safe-area-inset-bottom))] pt-[12px] ${dark ? "border-tank bg-tank-deep" : "border-line bg-card"}`}>{dock}</div>}
    </div>
  );
}

/** a question that rises from the bottom of the phone (skip reason, no signer, "850 ลิตร ถูกต้องไหม") */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={onClose}
      className="confirm m-0 mx-auto mt-auto w-full max-w-md rounded-t-[24px] border-0 bg-card px-[16px] pb-[max(22px,env(safe-area-inset-bottom))] pt-[20px] text-ink"
    >
      {open && (
        <div className="flex flex-col gap-[12px]">
          <h2 id={id} className="font-display text-[22px] font-semibold leading-[1.3]">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** big radio rows of a sheet; the last choice may be "type your own" */
export function Choices({ name, options, value, onChange }: { name: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="flex flex-col gap-[8px]">
      {options.map((o) => (
        <label key={o} className={`flex min-h-[56px] items-center gap-[12px] rounded-[14px] border-2 px-[14px] ${value === o ? "border-earth bg-safety-soft" : "border-line bg-card"}`}>
          <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} className="size-[22px] accent-earth" />
          <span className="text-[17px]">{o}</span>
        </label>
      ))}
    </div>
  );
}

/** the meter photo, small; tap = the big picture */
export function Thumb({ src, alt, onOpen, size = 56 }: { src: string; alt: string; onOpen?: () => void; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={src} alt={alt} width={size} height={size} className="size-full object-cover" />;
  const box = "shrink-0 overflow-hidden rounded-[10px] bg-tank";
  return onOpen ? (
    <button type="button" onClick={onOpen} aria-label={`ดูรูปใหญ่ ${alt}`} className={box} style={{ width: size, height: size }}>
      {img}
    </button>
  ) : (
    <span className={box} style={{ width: size, height: size }}>
      {img}
    </span>
  );
}

export function Notice({ tone, children }: { tone: "warn" | "bad"; children: ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`rounded-[14px] border px-[14px] py-[10px] text-[15px] ${tone === "bad" ? "border-repair-line bg-repair-soft text-repair-ink" : "border-safety-line bg-safety-soft text-ink"}`}>
      {children}
    </div>
  );
}
