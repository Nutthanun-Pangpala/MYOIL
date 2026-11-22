import { loadTank } from "@/server/settings/settings-service";
import { TankForm } from "./tank-form";

export default async function TankPage() {
  const t = await loadTank();
  return <TankForm initial={t} />;
}
