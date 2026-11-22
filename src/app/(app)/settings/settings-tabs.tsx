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
    <nav aria-label="หมวดตั้งค่า" className="flex flex-wrap gap-2">
      {TABS.map((t) => {
        const on = path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-control border px-4 font-display ${on ? "border-earth bg-earth text-white" : "border-idle bg-card"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
