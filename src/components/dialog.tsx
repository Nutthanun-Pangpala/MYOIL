"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Confirm window (design 6.5 ยกเลิกใบ, 6.9 ปิดรอบ, 6.11 รีเซ็ตรหัสผ่าน): the page dims, focus stays inside,
 * Esc or the "no" button closes it. Native <dialog> so the browser keeps focus and the backdrop.
 */
export function ConfirmDialog({ open, title, onClose, children, wide }: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; /** a picture, not a question */ wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={onClose}
      className={`confirm mx-auto mt-[min(150px,12vh)] w-[calc(100%-48px)] ${wide ? "max-w-[960px]" : "max-w-[540px]"} rounded-card border-0 bg-card p-7 text-ink shadow-[0_24px_60px_rgb(33_26_21/0.4)]`}
    >
      {open && (
        <div className="flex flex-col gap-4">
          <h2 id={id} className="font-display text-[22px] font-semibold leading-[1.4]">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
