"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Design "บันทึกสำเร็จ": a short dark message at the bottom of the screen, the same verb as the button
 * ("บันทึก" → "บันทึกแล้ว"), gone after 5 seconds, never over the field being keyed.
 */
export function Toast({ children, link }: { children: ReactNode; link?: { href: string; label: string } }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShown(false), 5000);
    return () => clearTimeout(t);
  }, []);
  if (!shown) return null;
  return (
    <div role="status" className="no-print fixed bottom-6 right-6 z-40 flex max-w-[calc(100vw-48px)] flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[14px] bg-tank px-[18px] py-3 text-white shadow-[0_12px_30px_rgb(33_26_21/0.35)]">
      <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-working" />
      <span>{children}</span>
      {link && (
        <Link href={link.href} className="text-white underline">
          {link.label}
        </Link>
      )}
    </div>
  );
}
