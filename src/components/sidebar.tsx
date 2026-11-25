import Link from "next/link";
import { logout } from "@/app/login/actions";
import { formatLiters } from "@/lib/format";
import { roleLabel, type Role } from "@/lib/labels";
import { navFor } from "@/lib/nav";
import { NavIcon } from "./nav-icon";
import { NavLinks } from "./nav-links";
import { Logo } from "./ui";

/** what is in the truck now; `percent` only when the tank size is known */
export type StockNow = { liters: number; percent: number | null };

/**
 * ≥1024px full menu · 768–1023px icon rail · <768px top bar with a slide-down menu (no JS: <details>).
 * Look = design 6.x side menu: brand, order search, menu, "ในรถตอนนี้", user card.
 */
export function Sidebar({ name, role, stock, pendingCheck = 0 }: { name: string; role: Role; stock: StockNow | null; pendingCheck?: number }) {
  const items = navFor(role);
  const badges = { "/check": { count: pendingCheck, label: "ใบรอตรวจ" } };

  const brand = (
    <div className="flex flex-col gap-1 px-3.5">
      <Logo />
      <span className="text-[13px] text-sidebar-sub">สโตร์กลาง U WORK 999</span>
    </div>
  );

  const search = (
    <form action="/issues" method="get" role="search" className="flex h-11 items-center gap-2 rounded-control bg-black/20 px-3 text-sidebar-text">
      <NavIcon name="search" />
      <label htmlFor="nav-q" className="sr-only">
        ค้นหาเลขที่ใบจ่าย
      </label>
      <input id="nav-q" name="q" type="search" placeholder="ค้นหาเลขที่ใบ" className="h-10 w-full min-w-0 flex-1 border-0 bg-transparent text-[14px] text-white outline-none placeholder:text-[#cbbfb2]" />
    </form>
  );

  const stockCard = stock && (
    <Link href="/ledger" className="flex flex-col gap-1.5 rounded-[14px] bg-black/20 px-3.5 pb-4 pt-3.5 text-white no-underline hover:bg-black/30">
      <span className="text-[13px] text-sidebar-sub">ในรถตอนนี้</span>
      <span className="num text-left font-display text-[22px] font-medium leading-tight">
        {formatLiters(stock.liters)} <span className="text-sm font-normal">ลิตร</span>
      </span>
      {stock.percent !== null && (
        <span aria-hidden="true" className="mt-0.5 block h-2.5 rounded-[5px] bg-white/20">
          <span className="block h-2.5 rounded-[5px] bg-safety" style={{ width: `${Math.max(0, Math.min(100, stock.percent))}%` }} />
        </span>
      )}
    </Link>
  );

  const who = (
    <div className="flex flex-col rounded-[14px] bg-white/8">
      <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-safety text-ink">
          <NavIcon name="user" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-display text-[15px] font-medium leading-snug text-white">{name}</span>
          <span className="text-[13px] leading-snug text-sidebar-sub">{roleLabel[role]}</span>
        </div>
      </div>
      <form action={logout} className="border-t border-white/15">
        <button type="submit" className="flex min-h-11 w-full items-center gap-2.5 rounded-b-[14px] px-3.5 text-sm text-sidebar-text hover:text-white">
          <NavIcon name="logout" />
          ออกจากระบบ
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* ≥768px: rail / full menu */}
      <aside className="no-print sticky top-0 hidden h-screen shrink-0 flex-col gap-7 overflow-y-auto bg-earth px-3 py-7 md:flex md:w-[72px] lg:w-[232px] lg:px-4 lg:pb-6">
        <div className="hidden lg:flex lg:flex-col lg:gap-7">
          {brand}
          {search}
        </div>
        <nav aria-label="เมนูหลัก" className="flex flex-col gap-1 lg:hidden">
          <NavLinks items={items} showLabel={false} badges={badges} />
        </nav>
        <nav aria-label="เมนูหลัก" className="hidden flex-col gap-1 lg:flex">
          <NavLinks items={items} showLabel badges={badges} />
        </nav>
        <div className="mt-auto hidden flex-col gap-3 lg:flex">
          {stockCard}
          {who}
        </div>
      </aside>

      {/* <768px: top bar */}
      <header className="no-print bg-earth p-3 md:hidden">
        <details>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-1">
            <Logo />
            <span className="text-[14px] text-sidebar-text">เมนู</span>
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            {search}
            <nav aria-label="เมนูหลัก" className="flex flex-col gap-1">
              <NavLinks items={items} showLabel badges={badges} />
            </nav>
            {stockCard}
            {who}
          </div>
        </details>
      </header>
    </>
  );
}
