import Link from "next/link";
import { DriverShell } from "@/components/driver/driver-shell";
import { TruckArt, TruckIcon } from "@/components/driver/truck-art";
import { odometer, tankLevel } from "@/domain/driver-home";
import { requireDriver } from "@/lib/session";
import { tankNow } from "@/server/bookcare/read-service";
import { litersOfIssues, routeForDate } from "@/server/routes/route-service";
import { HomeBanner, HomeDock, HomeRoute, type HomeStop } from "./home-route";

export const metadata = { title: "วันนี้" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const dock =
  "flex min-h-[62px] w-full items-center justify-center gap-[10px] rounded-[16px] border px-[16px] text-center font-display text-[20px] font-medium no-underline";
const yellow = `${dock} border-safety-line bg-safety text-ink shadow-[0_4px_0_var(--color-safety-deep)]`;

/**
 * The driver's home = design "MYOIL — หน้าจอฝั่ง พขร. (ขั้นที่ 2)", boards Main and HomeNoRoute:
 * dark tank card (liters as odometer tiles, the truck filled to the level) → today's route as a timeline.
 * Stage 2: every stop opens its page, the dock starts or resumes a fill, and slips still on the phone show here.
 */
export default async function DriverHome() {
  const s = await requireDriver();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const [tank, route] = await Promise.all([tankNow(today), routeForDate(today)]);
  const stops = route?.stops ?? [];
  const liters = await litersOfIssues(stops.flatMap((x) => (x.issueId ? [x.issueId] : [])));
  const filled = stops.filter((x) => x.status === "filled");
  const filledLiters = filled.reduce((a, x) => a + (liters.get(x.issueId!) ?? 0), 0);
  const home: HomeStop[] = stops.map((x) => ({ id: x.id, position: x.position, code: x.projectRefCode, name: x.projectName, note: x.note, status: x.status, issueId: x.issueId, skipReason: x.skipReason, liters: x.issueId ? (liters.get(x.issueId) ?? null) : null }));
  const inTruck = Number(tank.liters);
  const capacity = tank.capacity == null ? null : Number(tank.capacity);

  return (
    <DriverShell
      firstName={s.name.split(" ")[0]}
      dock={
        stops.length === 0 ? (
          <a href="/driver" className={yellow}>
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3" />
              <path d="M18 3v4h-4M6 21v-4h4" />
            </svg>
            โหลดเส้นทางอีกครั้ง
          </a>
        ) : (
          <HomeDock stops={home} />
        )
      }
    >
      <HomeBanner />
      <section aria-label="น้ำมันในรถตอนนี้" className="relative shrink-0 overflow-hidden rounded-[24px] bg-tank text-white" data-testid="driver-home">
        <div className="flex items-end justify-between gap-[8px] pl-[18px] pt-[14px]">
          <div className="flex min-w-0 flex-col gap-[6px] pb-[12px]">
            <span className="text-[15px] text-page">ในรถตอนนี้</span>
            <span className="flex items-end gap-[3px]">
              <span className="sr-only" data-testid="driver-tank">
                {fmt(inTruck)}
              </span>
              {odometer(inTruck).map((c, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={`inline-flex h-[45px] items-center justify-center font-display text-[36px] font-semibold leading-none text-safety ${c === "," ? "w-[11px]" : "w-[27px] rounded-[7px] bg-tank-deep shadow-[inset_0_-3px_0_rgb(0_0_0/0.45)]"}`}
                >
                  {c}
                </span>
              ))}
              <span className="pb-[8px] pl-[5px] font-display text-[18px] leading-none text-page">ลิตร</span>
            </span>
            <span className="text-[14px] text-tank-text">
              อัปเดตล่าสุด {tank.asOf.slice(11, 16)}
              {capacity ? ` · จุ ${fmt(capacity)} ลิตร` : ""}
            </span>
          </div>
          <div className="shrink-0 pr-[10px]">
            <TruckArt id="home-tank" level={tankLevel(inTruck, capacity)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-[10px] bg-tank-deep py-[8px] pl-[18px] pr-[8px]">
          <span className="whitespace-nowrap leading-[1.35]">
            <span className="text-[14px] text-tank-text">{filled.length ? `วันนี้เติมแล้ว ${filled.length} จาก ${stops.length} จุด` : "วันนี้ยังไม่ได้เติม"}</span>
            <br />
            <span className="font-display text-[18px] font-medium">{fmt(filledLiters)} ลิตร</span>
          </span>
          <Link href="/driver/refill" className="flex min-h-[56px] items-center gap-[8px] whitespace-nowrap rounded-[14px] border-2 border-page px-[14px] font-display text-[16px] font-medium text-white no-underline">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" className="stroke-safety">
              <path d="M12 5v14M5 12h14" />
            </svg>
            เติมน้ำมันเข้ารถ
          </Link>
        </div>
      </section>

      {stops.length === 0 ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-[10px] px-[12px] py-[8px] text-center" data-testid="driver-route">
          <span className="flex size-[72px] items-center justify-center rounded-full border-2 border-dashed border-idle bg-card">
            <TruckIcon />
          </span>
          <h2 className="font-display text-[23px] font-semibold leading-[1.3]">วันนี้ยังไม่มีเส้นทาง</h2>
          <p>แอดมินสโตร์กลางยังไม่ได้วางเส้นทางของวันนี้ จึงยังเริ่มเติมไม่ได้</p>
          <p className="text-[14px] text-muted">ถ้าต้องเติมด่วน โทรหาแอดมินสโตร์กลาง หรือเขียนใบจ่ายกระดาษจากเล่มสำรองบนรถ</p>
        </section>
      ) : (
        <section aria-labelledby="route-h" className="flex flex-col gap-[8px]" data-testid="driver-route">
          <div className="flex items-baseline justify-between gap-[10px]">
            <h2 id="route-h" className="font-display text-[19px] font-medium">
              เส้นทางวันนี้
            </h2>
            <span className="text-[14px] text-muted">แอดมินวางไว้ เรียงตามลำดับ</span>
          </div>
          <HomeRoute stops={home} />
        </section>
      )}
    </DriverShell>
  );
}
