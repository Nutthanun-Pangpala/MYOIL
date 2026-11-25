import { listMachines } from "@/server/settings/settings-service";
import { MachinesPanel } from "./machines-panel";

export const metadata = { title: "เครื่องจักร" };

export default async function MachinesPage() {
  const rows = await listMachines("");
  return <MachinesPanel rows={rows} />;
}
