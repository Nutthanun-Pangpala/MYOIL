import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Same look as BookCare's ui.tsx: yellow = primary button only; one primary per page. */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-card shadow-[0_3px_0_var(--color-line)] ${className}`}>{children}</div>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };

export function Button({ variant = "secondary", className = "", ...rest }: ButtonProps) {
  const look = {
    primary: "border border-safety-line bg-safety text-ink shadow-[0_3px_0_var(--color-safety-deep)] hover:brightness-95",
    secondary: "border border-idle bg-card text-ink shadow-[0_3px_0_var(--color-line)] hover:bg-page",
    ghost: "text-earth hover:bg-page",
  }[variant];
  return (
    <button
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control px-5 font-display text-base font-medium disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`}
    />
  );
}

/** link that looks like a button */
export function linkButton(variant: "primary" | "secondary" = "secondary") {
  const look =
    variant === "primary"
      ? "border border-safety-line bg-safety text-ink shadow-[0_3px_0_var(--color-safety-deep)] hover:brightness-95"
      : "border border-idle bg-card text-ink shadow-[0_3px_0_var(--color-line)] hover:bg-page";
  return `inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control px-5 font-display text-base font-medium ${look}`;
}

/** status is always colour AND word */
export function Pill({ tone, children }: { tone: "ok" | "wait" | "bad"; children: ReactNode }) {
  const look = {
    ok: "bg-working-soft text-working",
    wait: "bg-idle-soft text-earth",
    bad: "bg-repair-soft text-repair",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${look}`}>{children}</span>;
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
