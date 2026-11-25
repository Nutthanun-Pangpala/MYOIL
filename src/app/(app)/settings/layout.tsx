import Link from "next/link";
import { Card, PageHeader, StateBox, linkButton } from "@/components/ui";
import { canAdminister } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  if (!canAdminister(session)) {
    // design "ไม่มีสิทธิ์เข้าหน้านี้": the menu already hides it; this is for a link opened directly
    return (
      <>
        <PageHeader title="ไม่มีสิทธิ์เข้าหน้านี้" />
        <Card className="max-w-2xl p-6">
          <StateBox
            title="บัญชีนี้เปิดหน้า ตั้งค่า ไม่ได้"
            actions={
              <Link href="/" className={linkButton("primary")}>
                กลับไปภาพรวม
              </Link>
            }
          >
            หน้านี้สำหรับผู้ดูแลระบบ ถ้าต้องใช้ ให้ติดต่อผู้ดูแลระบบ
          </StateBox>
        </Card>
      </>
    );
  }
  // each tab draws <SettingsHeader/> itself, so a tab can put its button ("เพิ่มผู้ใช้") next to the title
  return <div className="flex flex-col gap-6">{children}</div>;
}
