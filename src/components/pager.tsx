import Link from "next/link";
import { PageSizeSelect } from "./page-size-select";

export const PAGE_SIZES = [20, 50, 100] as const;

/** a page number from the address, kept inside 1…pages */
export const pageFrom = (raw: string, pages: number) => Math.min(pages, Math.max(1, Math.floor(Number(raw)) || 1));
/** a page size from the address: one of PAGE_SIZES, else the first */
export const sizeFrom = (raw: string) => (PAGE_SIZES as readonly number[]).includes(Number(raw)) ? Number(raw) : PAGE_SIZES[0];

const btn = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border px-3 font-display text-[15px] no-underline";

/**
 * Design 6.3 pager: "แสดงใบที่ 1–20 จาก 84 ใบ" · ก่อนหน้า · 1 2 3 4 5 · ถัดไป · ใบต่อหน้า.
 * `href(page, size)` makes each link (filters stay).
 */
export function Pager({
  id,
  label,
  unit,
  total,
  page,
  size,
  href,
}: {
  id: string;
  label: string;
  unit: string;
  total: number;
  page: number;
  size: number;
  href: (page: number, size: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const first = total === 0 ? 0 : (page - 1) * size + 1;
  const last = Math.min(total, page * size);
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const off = `${btn} cursor-not-allowed border-line bg-page text-muted`;
  const on = `${btn} border-idle bg-card text-ink hover:bg-page`;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-[18px]">
      <span className="text-muted">
        แสดง{unit}ที่ {first}–{last} จาก {total} {unit}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1, size)} className={on}>
            ก่อนหน้า
          </Link>
        ) : (
          <span aria-disabled="true" className={off}>
            ก่อนหน้า
          </span>
        )}
        {nums.map((n) =>
          n === page ? (
            <span key={n} aria-current="page" aria-label={`หน้า ${n}`} className={`${btn} border-earth bg-earth text-white`}>
              {n}
            </span>
          ) : (
            <Link key={n} href={href(n, size)} aria-label={`หน้า ${n}`} className={on}>
              {n}
            </Link>
          ),
        )}
        {page < pages ? (
          <Link href={href(page + 1, size)} className={on}>
            ถัดไป
          </Link>
        ) : (
          <span aria-disabled="true" className={off}>
            ถัดไป
          </span>
        )}
      </div>
      <PageSizeSelect id={`${id}-size`} label={`${unit}ต่อหน้า`} size={size} links={Object.fromEntries(PAGE_SIZES.map((s) => [String(s), href(1, s)]))} />
    </nav>
  );
}
