import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { canOpen } from "@/lib/nav";
import { requireUser } from "@/lib/session";
import { stockOn } from "@/server/ledger/ledger-service";
import { countPendingReview } from "@/server/issues/review-service";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser();
  // a driver has only the /driver screens (25 Nov 2026)
  if (s.role === "driver") redirect("/driver");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const [stock, pendingCheck] = await Promise.all([
    canOpen(s.role, "/ledger") ? stockOn(today) : null,
    // the yellow number on "ตรวจใบมือถือ" (design side menu)
    canOpen(s.role, "/check") ? countPendingReview() : 0,
  ]);
  return (
    <div className="min-h-screen md:flex">
      <Sidebar name={s.name} role={s.role} stock={stock} pendingCheck={pendingCheck} />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-12 pt-6 md:px-10 md:pt-8">{children}</main>
    </div>
  );
}
