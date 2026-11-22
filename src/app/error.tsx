"use client";

/** Any crash lands here: plain words and a retry, never the SQL or stack trace (test BUG-02). The real error stays in the server log; `digest` lets us find it. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-start justify-center gap-4 px-6">
      <h1 className="font-display text-[28px] font-semibold">มีบางอย่างผิดพลาด</h1>
      <p className="text-muted">ระบบทำรายการนี้ไม่สำเร็จ ลองใหม่อีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ พร้อมรหัสด้านล่าง</p>
      {error.digest && <code className="rounded-control bg-card px-3 py-1.5 text-sm">รหัสอ้างอิง {error.digest}</code>}
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="min-h-11 rounded-control border border-safety-line bg-safety px-5 font-display font-medium shadow-[0_3px_0_var(--color-safety-deep)]">
          ลองอีกครั้ง
        </button>
        <a href="/" className="inline-flex min-h-11 items-center rounded-control border border-idle bg-card px-5 font-display font-medium">
          กลับหน้าภาพรวม
        </a>
      </div>
    </main>
  );
}
