import type { ReactNode } from "react";
import { DriverNav } from "./driver-nav";

/** phone frame of every driver page: brand + greeting on top, the page's main button and the tabs at the bottom */
export function DriverShell({ firstName, dock, children }: { firstName: string; dock?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page text-ink">
      <header className="flex flex-col gap-[10px] border-b border-line bg-card px-[20px] pb-[14px] pt-[max(24px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1 font-display text-[20px] font-semibold leading-none text-earth">
            MY<span className="rounded-[0.22em] bg-safety px-[0.2em] pb-[0.08em] pt-[0.03em] text-ink">OIL</span>
          </p>
          <span className="rounded-full bg-page px-[12px] py-[6px] text-[14px] font-semibold text-earth">รถเติมน้ำมัน</span>
        </div>
        <p className="font-display text-[20px] font-semibold">สวัสดีครับ คุณ{firstName}</p>
      </header>
      <main className="flex flex-1 flex-col gap-[12px] px-[16px] pb-[16px] pt-[14px]">{children}</main>
      <div className="sticky bottom-0 flex flex-col gap-[6px] border-t border-line bg-card px-[16px] pb-[max(6px,env(safe-area-inset-bottom))] pt-[12px]">
        {dock}
        <DriverNav />
      </div>
    </div>
  );
}
