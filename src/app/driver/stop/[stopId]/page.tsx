import { redirect } from "next/navigation";
import { machineArt } from "@/domain/driver-fill";
import { requireDriver } from "@/lib/session";
import { machinesForPhone } from "@/server/bookcare/read-service";
import { routeForDate } from "@/server/routes/route-service";
import { machineTypes } from "@/server/driver/slip-service";
import { StopFlow, type FlowMachine } from "./stop-flow";

export const metadata = { title: "จุดเติม" };
export const dynamic = "force-dynamic";

/** one stop of today's route: the plan, then the whole fill → sign flow on the phone (design boards Stop … Sign) */
export default async function StopPage({ params }: { params: Promise<{ stopId: string }> }) {
  const s = await requireDriver();
  const { stopId } = await params;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const route = await routeForDate(today);
  const stop = route?.stops.find((x) => x.id === stopId);
  if (!route || !stop) redirect("/driver");
  if (stop.status === "filled" && stop.issueId) redirect(`/driver/slip/${stop.issueId}`);

  const types = await machineTypes();
  const machines: FlowMachine[] = (await machinesForPhone(today)).map((m) => ({
    art: machineArt(m.code, types.get(m.id)),
    id: m.id,
    code: m.code,
    name: m.name,
    isRented: m.isRented,
    here: m.projects.includes(stop.projectRefCode),
    maxLiters: m.maxLiters === null ? null : Number(m.maxLiters),
  }));

  return (
    <StopFlow
      stop={{ id: stop.id, position: stop.position, code: stop.projectRefCode, name: stop.projectName, detail: stop.projectDetail, note: stop.note, skipped: stop.status === "skipped", skipReason: stop.skipReason }}
      dots={route.stops.map((x) => (x.id === stop.id ? "here" : x.status))}
      date={today}
      driverName={s.name}
      machines={machines}
    />
  );
}
