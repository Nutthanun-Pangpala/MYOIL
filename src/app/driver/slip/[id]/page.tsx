import { redirect } from "next/navigation";
import { thaiLong } from "@/domain/thai-date";
import { requireDriver } from "@/lib/session";
import { driverSlip } from "@/server/driver/slip-service";
import { SlipView } from "./slip-view";

export const metadata = { title: "ใบจ่าย" };
export const dynamic = "force-dynamic";

/** a slip that reached MYOIL (design boards Detail, DetailWait): read-only; a missing signature can still be asked for */
export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireDriver();
  const slip = await driverSlip((await params).id);
  if (!slip) redirect("/driver");
  const when = `${thaiLong(slip.date)}${slip.timeIn ? ` เวลา ${slip.timeIn}${slip.timeOut ? `–${slip.timeOut}` : ""}` : ""}`;
  return <SlipView slip={slip} when={when} />;
}
