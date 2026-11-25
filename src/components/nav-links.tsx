"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./nav-icon";

type Item = { href: string; label: string; icon: string };

/** the current page is lit (white text, yellow icon); a count (ใบรอตรวจ) sits at the right — client only for usePathname */
export function NavLinks({ items, showLabel, badges = {} }: { items: Item[]; showLabel: boolean; badges?: Record<string, { count: number; label: string }> }) {
  const path = usePathname();
  return items.map((n) => {
    const active = n.href === "/" ? path === "/" : path === n.href || path.startsWith(`${n.href}/`);
    const badge = badges[n.href];
    const hasBadge = !!badge && badge.count > 0;
    return (
      <Link
        key={n.href}
        href={n.href}
        title={hasBadge ? `${n.label} ${badge.count} ${badge.label}` : n.label}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-control px-3.5 font-display text-base no-underline ${active ? "bg-white/14 text-white" : "text-sidebar-text hover:bg-white/8 hover:text-white"}`}
      >
        <span className={`relative inline-flex ${active ? "text-safety" : ""}`}>
          <NavIcon name={n.icon} />
          {/* icon rail: no room for the number, a yellow dot says "something waits" */}
          {hasBadge && !showLabel && <span aria-hidden className="absolute -right-1 -top-1 size-2.5 rounded-full bg-safety" />}
        </span>
        {showLabel && n.label}
        {hasBadge && showLabel && (
          <span className="ml-auto min-w-6 rounded-full bg-safety px-[7px] py-px text-center text-[13px] font-medium text-ink">
            {badge.count}
            <span className="sr-only"> {badge.label}</span>
          </span>
        )}
        {hasBadge && !showLabel && <span className="sr-only">{`${n.label} ${badge.count} ${badge.label}`}</span>}
      </Link>
    );
  });
}
