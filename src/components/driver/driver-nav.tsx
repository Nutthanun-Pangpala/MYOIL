"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/driver", label: "วันนี้" },
  { href: "/driver/account", label: "บัญชี" },
];

/** bottom tabs of the driver's screens (ประวัติ comes with the slips, stage 2) */
export function DriverNav() {
  const path = usePathname();
  return (
    <nav aria-label="เมนูคนขับ" className="grid grid-cols-2">
      {TABS.map((t) => {
        const on = path === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={`flex min-h-[52px] flex-col items-center justify-center gap-[6px] text-[14px] font-semibold no-underline ${on ? "text-ink" : "text-muted"}`}>
            <span aria-hidden="true" className={`h-[3px] w-[28px] rounded-[3px] ${on ? "bg-safety" : ""}`} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
