import { canAdminister } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  if (!canAdminister(session)) {
    return (
      <div className="flex max-w-xl flex-col gap-3 py-10">
        <h1 className="font-display text-2xl text-earth">ไม่มีสิทธิ์เข้าหน้านี้</h1>
        <p className="text-[15px]">หน้าตั้งค่าเปิดได้เฉพาะผู้ดูแลระบบ ถ้าต้องแก้ข้อมูลหลัก ให้แจ้งผู้ดูแลระบบ</p>
        <a href="/" className="text-earth underline">
          กลับหน้าภาพรวม
        </a>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold">ตั้งค่า</h1>
        <p className="text-[14px] text-muted">ข้อมูลหลักที่ผู้ดูแลระบบดูแล</p>
      </header>
      <SettingsTabs />
      {children}
    </div>
  );
}
