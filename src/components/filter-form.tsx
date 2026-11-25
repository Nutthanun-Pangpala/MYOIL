"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Filters of a list (design 6.3): no "กรอง" button — a dropdown or a date applies at once, a search box on Enter.
 * Empty fields are left out of the address so links stay short.
 */
export function FilterForm({
  action,
  children,
  className = "",
  search = true,
}: {
  action: string;
  children: ReactNode;
  className?: string;
  /** false for a chooser that is not a search (the claim-cycle box), so it is not announced as one */
  search?: boolean;
}) {
  const router = useRouter();
  function go(form: HTMLFormElement) {
    const q = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v.trim() !== "") q.set(k, v.trim());
    router.push(q.size ? `${action}?${q}` : action);
  }
  return (
    <form
      role={search ? "search" : undefined}
      method="get"
      action={action}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        go(e.currentTarget);
      }}
      onChange={(e) => {
        const t = e.target;
        if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && (t.type === "date" || t.type === "checkbox"))) go(e.currentTarget);
      }}
    >
      {children}
      <button type="submit" className="sr-only">
        {search ? "ค้นหา" : "เปิด"}
      </button>
    </form>
  );
}
