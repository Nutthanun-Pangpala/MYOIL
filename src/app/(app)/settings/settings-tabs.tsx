"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/projects", label: "โครงการ" },
  { href: "/settings/machines", label: "เครื่องจักร" },
  { href: "/settings/users", label: "ผู้ใช้" },
  { href: "/settings/cycles", label: "รอบเคลม" },
  { href: "/settings/tank", label: "รถเติมน้ำมัน" },
];

export function SettingsTabs() {
  const path = usePathname();
  return (
    // design 6.11: words on a line, the open one underlined in earth brown
    <nav aria-label="หมวดตั้งค่า" className="flex flex-wrap gap-x-7 border-b border-line">
      {TABS.map((t) => {
        const on = path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 items-center border-b-[3px] px-1 font-display text-[17px] no-underline ${on ? "border-earth text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
