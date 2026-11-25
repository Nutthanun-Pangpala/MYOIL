import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ" };

/** design 6.1: brand + fuel truck on the left, the form on the right, a road along the bottom; stacks on a phone */
export default async function LoginPage() {
  if (await getSession()) redirect("/");
  // OBS-22: who to call when the password is forgotten (name + phone/LINE), set in .env / Vercel
  const contact = process.env.ADMIN_CONTACT?.trim() || null;
  return (
    <div className="flex min-h-screen flex-col bg-page text-ink [container-type:inline-size]">
      <div className="mx-auto box-border flex w-full max-w-[1360px] flex-auto flex-wrap items-stretch gap-x-10 px-[4%]">
        <div className="flex min-w-0 flex-[1_1_440px] flex-col justify-between gap-[clamp(1.25rem,4cqw,2rem)] pt-[clamp(1.5rem,4cqw,2.5rem)]">
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-1.5 font-display text-[clamp(44px,11cqw,72px)] font-semibold leading-none text-earth">
              MY<span className="rounded-[0.22em] bg-safety px-[0.2em] pb-[0.08em] pt-[0.03em] text-ink">OIL</span>
            </p>
            <p className="text-[clamp(16px,4.2cqw,20px)] leading-normal text-muted">สมุดบัญชีน้ำมันของสโตร์กลาง U WORK 999</p>
          </div>
          <div className="flex flex-col">
            <Truck />
            <span aria-hidden className="block h-1 bg-tank" />
          </div>
        </div>
        <main className="box-border flex min-w-0 max-w-[460px] flex-[1_1_360px] items-center py-[clamp(1.5rem,4cqw,2.5rem)]">
          <div className="box-border flex w-full flex-col gap-5 rounded-card border border-line bg-card p-[clamp(24px,6cqw,32px)] shadow-[0_3px_0_var(--color-line)]">
            <h1 className="font-display text-[28px] font-semibold leading-[1.3]">เข้าสู่ระบบ</h1>
            <LoginForm contact={contact} />
          </div>
        </main>
      </div>
      <footer className="box-border min-h-[132px] flex-none bg-tank pb-6 pt-7 text-sidebar-text">
        <div className="mx-auto box-border flex w-full max-w-[1360px] flex-col gap-[22px] px-[4%]">
          <span aria-hidden className="block h-1 bg-[repeating-linear-gradient(90deg,var(--color-line)_0,var(--color-line)_30px,transparent_30px,transparent_56px)] opacity-35" />
          <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-sm">
            <span>สโตร์กลาง U WORK 999</span>
            <span>ใช้ได้เฉพาะผู้ที่ผู้ดูแลระบบเปิดบัญชีให้</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** the store's fuel truck; the tank fills once when the page opens (still for reduced motion) */
function Truck() {
  return (
    <svg role="img" aria-label="รถเติมน้ำมันของสโตร์กลาง" viewBox="30 34 602 195" className="block h-auto w-full">
      <defs>
        <clipPath id="login-tank">
          <rect x="49" y="57" width="386" height="114" rx="41" />
        </clipPath>
      </defs>
      <rect x="36" y="176" width="590" height="16" rx="4" fill="#a08670" />
      <rect x="252" y="190" width="118" height="28" rx="5" fill="#a08670" />
      <circle cx="280" cy="204" r="6" fill="#24180f" />
      <rect x="298" y="200" width="56" height="8" rx="4" fill="#24180f" />
      <rect x="150" y="41" width="46" height="14" rx="4" fill="#4a3426" />
      <rect x="290" y="41" width="46" height="14" rx="4" fill="#4a3426" />
      <rect x="438" y="148" width="20" height="12" fill="#a08670" />
      <rect x="44" y="52" width="396" height="124" rx="46" fill="#24180f" />
      <g clipPath="url(#login-tank)">
        <g className="fill-up" style={{ transform: "translateY(91px)" }}>
          <path className="wave-b" d="M-270 -4 q30 -6 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V150 H-270 Z" fill="#ffc72c" opacity="0.45" />
          <path className="wave-a" d="M-240 0 q30 -7 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V150 H-240 Z" fill="#ffc72c" />
        </g>
      </g>
      <path d="M63 142.5 H85 M52 114 H90 M63 85.5 H85" fill="none" stroke="#f5f5f3" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M100 68 H340" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.14" />
      <rect x="44" y="52" width="396" height="124" rx="46" fill="none" stroke="#4a3426" strokeWidth="6" />
      <path d="M456 176 V102 a12 12 0 0 1 12 -12 H548 a12 12 0 0 1 9 4 l46 50 a12 12 0 0 1 3 8 V176 Z" fill="#4a3426" />
      <path d="M514 102 H545 l37 41 H514 Z" fill="#f5f5f3" />
      <path d="M505 100 V176" fill="none" stroke="#33241a" strokeWidth="2" />
      <rect x="598" y="154" width="8" height="12" rx="2" fill="#ffc72c" />
      {[120, 196, 540].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="202" r="27" fill="#120c08" />
          <circle cx={cx} cy="202" r="12" fill="#f5f5f3" />
          <circle cx={cx} cy="202" r="4" fill="#a08670" />
        </g>
      ))}
    </svg>
  );
}
