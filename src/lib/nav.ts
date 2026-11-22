import type { Role } from "./labels";

/** Menu order and who sees what — brief §5. Each person sees only the menus they can use. */
export type NavItem = { href: string; label: string; icon: string; roles: Role[] };

const all: Role[] = ["store_admin", "project_viewer", "executive", "system_admin"];

export const NAV: NavItem[] = [
  { href: "/", label: "ภาพรวม", icon: "home", roles: all },
  { href: "/issues", label: "ใบจ่ายน้ำมัน", icon: "file", roles: all },
  { href: "/purchases", label: "ซื้อน้ำมันเข้า", icon: "truck", roles: ["store_admin", "system_admin"] },
  { href: "/ledger", label: "สมุดคงเหลือ", icon: "book", roles: ["store_admin", "executive", "system_admin"] },
  { href: "/monthly", label: "ตารางรายเดือน", icon: "grid", roles: all },
  { href: "/invoices", label: "ใบแจ้งค่าใช้จ่าย", icon: "receipt", roles: ["store_admin", "project_viewer", "executive", "system_admin"] },
  { href: "/settings", label: "ตั้งค่า", icon: "cog", roles: ["system_admin"] },
];

export const navFor = (role: Role) => NAV.filter((n) => n.roles.includes(role));

/** may this role open this menu's page (also guards the page itself, not only the menu) */
export const canOpen = (role: Role, href: string) => NAV.find((n) => n.href === href)?.roles.includes(role) ?? false;
