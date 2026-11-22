import { Sidebar } from "@/components/sidebar";
import { canOpen } from "@/lib/nav";
import { requireUser } from "@/lib/session";
import { stockOn } from "@/server/ledger/ledger-service";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const stock = canOpen(s.role, "/ledger") ? await stockOn(today) : null;
  return (
    <div className="min-h-screen md:flex">
      <Sidebar name={s.name} role={s.role} stock={stock} />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-12 pt-6 md:px-10 md:pt-8">{children}</main>
    </div>
  );
}
