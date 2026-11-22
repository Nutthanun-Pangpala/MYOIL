"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./nav-icon";

type Item = { href: string; label: string; icon: string };

/** the current page is lit (white text, yellow icon) — client only for usePathname */
export function NavLinks({ items, showLabel }: { items: Item[]; showLabel: boolean }) {
  const path = usePathname();
  return items.map((n) => {
    const active = n.href === "/" ? path === "/" : path === n.href || path.startsWith(`${n.href}/`);
    return (
      <Link
        key={n.href}
        href={n.href}
        title={n.label}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-control px-3.5 font-display text-base ${active ? "bg-white/14 text-white" : "text-sidebar-text hover:bg-white/8 hover:text-white"}`}
      >
        <span className={active ? "text-safety" : ""}>
          <NavIcon name={n.icon} />
        </span>
        {showLabel && n.label}
      </Link>
    );
  });
}
