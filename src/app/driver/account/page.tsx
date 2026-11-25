import { eq } from "drizzle-orm";
import { logout } from "@/app/login/actions";
import { card } from "@/components/driver/bits";
import { DriverShell } from "@/components/driver/driver-shell";
import { db, schema } from "@/db";
import { requireDriver } from "@/lib/session";

export const metadata = { title: "บัญชี" };

export default async function DriverAccount() {
  const s = await requireDriver();
  const [u] = await db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, s.userId)).limit(1);
  return (
    <DriverShell firstName={s.name.split(" ")[0]}>
      <section className={`${card} flex flex-col gap-[4px] p-[16px]`}>
        <span className="text-[14px] font-semibold text-muted">ชื่อ</span>
        <span className="font-display text-[20px] font-semibold">{s.name}</span>
        <span className="pt-[8px] text-[14px] font-semibold text-muted">เบอร์โทรที่ใช้เข้าระบบ</span>
        <span className="text-[17px]">{u?.phone ?? "–"}</span>
      </section>
      <p className="text-[14px] text-muted">ลืม PIN หรือเปลี่ยนเบอร์ ให้ผู้ดูแลระบบ MYOIL แก้ให้</p>
      <form action={logout}>
        <button type="submit" className="min-h-[56px] w-full rounded-control border-[1.5px] border-ink bg-card font-display text-[16px] font-semibold">
          ออกจากระบบ
        </button>
      </form>
    </DriverShell>
  );
}
