import { listMachines } from "@/server/settings/settings-service";
import { MachinesPanel } from "./machines-panel";

export const metadata = { title: "เครื่องจักร" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function MachinesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const rows = await listMachines(q);
  return <MachinesPanel rows={rows} q={q} />;
}
