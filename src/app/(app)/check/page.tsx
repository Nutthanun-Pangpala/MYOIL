import Link from "next/link";
import { Card, PageHeader, StateBox, linkButton } from "@/components/ui";
import { requireWriter } from "@/lib/session";
import { countCheckedToday, getReview, listPendingChecks } from "@/server/issues/review-service";
import { CheckDesk } from "./check-desk";

export const metadata = { title: "ตรวจใบมือถือ" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** design "ขั้นที่ 2 ตรวจใบจากมือถือ": the waiting slips on the left (oldest first), the one being checked on the right */
export default async function CheckPage({ searchParams }: { searchParams: SP }) {
  const session = await requireWriter();
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const [list, checkedToday] = await Promise.all([listPendingChecks(session), countCheckedToday(today)]);
  const at = Math.max(0, list.findIndex((x) => x.id === one(sp.id)));
  const cur = list[at] ?? null;
  const review = cur ? await getReview(cur.id) : null;

  return (
    <>
      <PageHeader title="ตรวจใบจากมือถือ" sub="เทียบรูปมิเตอร์กับลิตรที่ พขร. พิมพ์ ใบที่ตรวจแล้วเท่านั้นจึงเข้าใบแจ้งค่าใช้จ่าย" />
      {cur && review ? (
        <CheckDesk
          list={list}
          at={at}
          checkedToday={checkedToday}
          review={{
            lines: review.lines.map((l) => ({ lineId: l.lineId, position: l.position, machineId: l.machineId, machine: l.machine, machinePending: l.machinePending, liters: l.liters, hasPhoto: l.hasPhoto, photoTakenAt: l.photoTakenAt })),
            knownMachines: review.knownMachines,
            driverName: review.driverName,
            unsignedReason: review.unsignedReason,
          }}
        />
      ) : (
        <Card className="p-6">
          <StateBox
            title="ตรวจครบทุกใบแล้ว"
            actions={
              <Link href="/issues" className={linkButton("secondary")}>
                ไปรายการใบจ่าย
              </Link>
            }
          >
            ใบใหม่จากมือถือของ พขร. จะขึ้นที่หน้านี้เอง ใบที่ตรวจแล้วดูย้อนหลังได้ที่รายการใบจ่าย
            {checkedToday > 0 && ` วันนี้ตรวจแล้ว ${checkedToday} ใบ`}
          </StateBox>
        </Card>
      )}
      <p className="text-sm text-muted">น้ำมันของใบที่รอตรวจถูกหักจากยอดในรถแล้วตั้งแต่ พขร. ส่งใบ การตรวจมีผลกับใบแจ้งค่าใช้จ่ายเท่านั้น</p>
    </>
  );
}
