import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Building blocks drawn from the design canvas "MYOIL — โครงหน้าจอ 11 หน้า".
 * Yellow = primary button and things that stand for fuel only; one primary per page.
 */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-card shadow-[0_3px_0_var(--color-line)] ${className}`}>{children}</div>;
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerOutline";

const LOOK: Record<Variant, string> = {
  primary: "border border-safety-line bg-safety text-ink shadow-[0_3px_0_var(--color-safety-deep)] hover:brightness-95",
  secondary: "border border-idle bg-card text-ink shadow-[0_3px_0_var(--color-line)] hover:bg-page",
  ghost: "text-earth hover:bg-page",
  // "ยืนยันยกเลิก" in a confirm window
  danger: "border border-repair bg-repair text-white shadow-[0_3px_0_var(--color-repair-deep)] hover:brightness-95",
  // "ยกเลิกใบ" next to "แก้ไข": red words on white
  dangerOutline: "border border-repair bg-card text-repair shadow-[0_3px_0_var(--color-repair-line)] hover:bg-repair-soft",
};
const BASE = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control px-5 font-display text-base font-medium no-underline";
// design: a button that can't be pressed is grey, not a faded yellow
const DISABLED = "disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-gray-ink disabled:shadow-none disabled:hover:brightness-100";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = "secondary", className = "", ...rest }: ButtonProps) {
  return <button {...rest} className={`${BASE} ${LOOK[variant]} ${DISABLED} ${className}`} />;
}

/** link that looks like a button */
export function linkButton(variant: Variant = "secondary") {
  return `${BASE} ${LOOK[variant]}`;
}

/** plain text link (design: earth brown, underlined, ink on hover) */
export const linkClass = "text-earth underline hover:text-ink";

/** status is always colour AND word: a dot, then the word */
export type Tone = "ok" | "wait" | "bad" | "off";
const PILL: Record<Tone, [string, string]> = {
  ok: ["bg-working-soft text-working-ink", "bg-working"],
  wait: ["bg-idle-soft text-idle-ink", "bg-idle"],
  bad: ["bg-repair-soft text-repair-ink", "bg-repair"],
  off: ["bg-gray-soft text-gray-ink", "bg-muted"],
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const [look, dot] = PILL[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-[3px] pl-2.5 pr-3 text-[13px] font-medium ${look}`}>
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

/** a project is shown by its code in a small brown tag; the full name goes in the tooltip */
export function ProjectChip({ code, name }: { code: string; name?: string }) {
  return (
    <span title={name} className="inline-block whitespace-nowrap rounded-lg bg-idle-soft px-2.5 py-0.5 font-display text-sm font-medium text-earth">
      {code}
    </span>
  );
}

/** top of every page: (back link) · big title · one line under it · buttons on the right */
export function PageHeader({ title, sub, back, actions }: { title: ReactNode; sub?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {back && (
          <Link href={back.href} className={`self-start text-sm ${linkClass}`}>
            {back.label}
          </Link>
        )}
        <h1 className="font-display text-[34px] font-semibold leading-[1.3]">{title}</h1>
        {sub && <p className="text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

/** card title (design: Kanit 500, 20px) */
export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-display text-xl font-medium leading-[1.4] ${className}`}>{children}</h2>;
}

/** inputs and selects: 44px, brown border, 12px corners */
export const fieldClass = "h-11 w-full min-w-0 rounded-control border border-idle bg-card px-3 text-ink";
/** a field that blocks saving */
export const fieldBadClass = "border-2 border-repair";

/** label above, control, then a red message (blocks saving) or a brown warning (still saves) */
export function Field({
  label,
  htmlFor,
  optional,
  error,
  warning,
  hint,
  className = "",
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  error?: ReactNode;
  warning?: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm">
        {label}
        {optional && <span className="text-muted"> (ไม่บังคับ)</span>}
      </label>
      {children}
      {error && <FieldError>{error}</FieldError>}
      {!error && warning && <FieldWarning>{warning}</FieldWarning>}
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
    </div>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 text-[13px] leading-normal text-repair">{children}</span>;
}

export function FieldWarning({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 text-[13px] leading-normal text-warn-ink">{children}</span>;
}

function WarnIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17v.5" />
    </svg>
  );
}

/** a message that stops the person (red box with a triangle) */
export function Alert({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={`flex items-start gap-2.5 rounded-control border border-repair bg-repair-soft px-3.5 py-3 text-repair-ink ${className}`}>
      <WarnIcon />
      <span>{children}</span>
    </div>
  );
}

/** "คำเตือน" box: yellow-soft, still lets the person carry on */
export function Notice({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div role="note" className={`flex items-start gap-2.5 rounded-control bg-safety-soft px-3.5 py-3 text-ink ${className}`}>
      <WarnIcon />
      <span>{children}</span>
    </div>
  );
}

/** empty / failed / no-access box (design "สถานะร่วมของทุกหน้า") */
export function StateBox({ title, children, actions, tone = "plain" }: { title: ReactNode; children?: ReactNode; actions?: ReactNode; tone?: "plain" | "error" }) {
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`flex flex-col items-start gap-2.5 rounded-[14px] border bg-page p-6 ${tone === "error" ? "border-repair" : "border-line"}`}>
      <span className={`font-display text-lg font-medium ${tone === "error" ? "text-repair" : "text-ink"}`}>{title}</span>
      {children && <div>{children}</div>}
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

/** a key on the keyboard */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-block whitespace-nowrap rounded-md border border-idle bg-card px-2 py-px font-display text-[13px] shadow-[0_2px_0_var(--color-line)]">{children}</kbd>;
}

/** grey bars in the shape of a table while its rows load */
export function SkeletonRows({ rows = 4, label }: { rows?: number; label: string }) {
  const widths = ["30%", "22%", "34%", "26%", "28%", "20%"];
  return (
    <div role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-5 border-b border-line py-3.5">
          <span className="skeleton flex-[0_0_12%]" />
          <span className="skeleton flex-[0_0_16%]" />
          <span className="skeleton" style={{ flex: `0 0 ${widths[i % widths.length]}` }} />
          <span className="skeleton flex-[0_0_10%]" />
        </div>
      ))}
    </div>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg aria-hidden="true" width="34" height="22" viewBox="0 0 34 22" className="shrink-0">
        <path d="M5 12 q3 -2.5 6 0 t6 0 t6 0 t6 0 a6 6 0 0 1 -6 6 H11 a6 6 0 0 1 -6 -6 Z" className="fill-safety" />
        <rect x="1" y="1" width="32" height="20" rx="10" className="fill-none stroke-white" strokeWidth="2" />
      </svg>
      <span className="font-display text-[26px] font-semibold leading-tight tracking-[0.02em] text-white">MYOIL</span>
    </span>
  );
}
