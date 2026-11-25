import { redirect } from "next/navigation";
import { TruckArt } from "@/components/driver/truck-art";
import { lastDriver } from "@/lib/remember";
import { getSession } from "@/lib/session";
import { DriverLoginForm } from "./driver-login-form";

export const metadata = { title: "คนขับเข้าสู่ระบบ" };

/** the fuel-truck driver's door (owner, 25 Nov 2026): phone + PIN on one big keypad, as easy as BookCare's; header from design board "Login" */
export default async function DriverLoginPage() {
  const s = await getSession();
  if (s) redirect(s.role === "driver" ? "/driver" : "/");
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page text-ink">
      <header className="shrink-0 overflow-hidden bg-tank text-white">
        <div className="flex items-end justify-between gap-[8px] pl-[20px] pt-[max(26px,env(safe-area-inset-top))]">
          <div className="flex min-w-0 flex-col gap-[8px] pb-[18px]">
            <p className="flex items-center gap-[5px] font-display text-[44px] font-semibold leading-none">
              MY<span className="rounded-[10px] bg-safety px-[9px] pb-[4px] pt-[1px] text-ink">OIL</span>
            </p>
            <span className="whitespace-nowrap text-[15px] text-page">สำหรับ พขร. รถเติมน้ำมัน</span>
          </div>
          <div className="shrink-0 pr-[12px]">
            <TruckArt id="login-tank" level={0.62} />
          </div>
        </div>
        <span aria-hidden="true" className="block h-[3px] bg-idle" />
        <span aria-hidden="true" className="block h-[14px] bg-tank-deep" />
      </header>
      <DriverLoginForm remembered={await lastDriver()} contact={process.env.ADMIN_CONTACT?.trim() || null} />
    </div>
  );
}
