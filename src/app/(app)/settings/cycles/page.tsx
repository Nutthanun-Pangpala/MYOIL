import { listCyclesForSettings, loadCutDay } from "@/server/settings/settings-service";
import { CyclesPanel } from "./cycles-panel";

export const metadata = { title: "รอบเคลม" };

export default async function CyclesPage() {
  const cycles = await listCyclesForSettings();
  return <CyclesPanel cycles={cycles} cutDay={await loadCutDay()} />;
}
