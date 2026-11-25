"use client";

import Link from "next/link";
import { Button, Card, StateBox, linkButton } from "@/components/ui";

/**
 * design "เกิดข้อผิดพลาด": say what did not work, that saved data is safe, and what to do next — inside the app,
 * menu still there. Never the SQL or a stack trace (test BUG-02); `digest` lets us find it in the server log.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="p-6">
      <StateBox
        tone="error"
        title="โหลดหน้านี้ไม่สำเร็จ"
        actions={
          <>
            <Button variant="primary" onClick={reset}>
              ลองใหม่
            </Button>
            <Link href="/" className={linkButton("secondary")}>
              กลับไปภาพรวม
            </Link>
          </>
        }
      >
        ข้อมูลที่บันทึกไว้แล้วไม่หาย ตรวจอินเทอร์เน็ต แล้วลองใหม่ ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ
        {error.digest && <span className="mt-1 block text-[13px] text-muted">รหัสอ้างอิง {error.digest}</span>}
      </StateBox>
    </Card>
  );
}
