import { listCyclesForSettings } from "@/server/settings/settings-service";
import { CyclesPanel } from "./cycles-panel";

export const metadata = { title: "รอบบิล" };

export default async function CyclesPage() {
  const cycles = await listCyclesForSettings();
  return <CyclesPanel cycles={cycles} />;
}
