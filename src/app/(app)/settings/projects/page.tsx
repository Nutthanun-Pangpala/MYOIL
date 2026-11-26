import { listProjects } from "@/server/settings/settings-service";
import { ProjectsTable } from "./projects-table";

export const metadata = { title: "โครงการ" };

/** ตั้งค่า › โครงการ: MYOIL's own list — add, rename, open and close (test round 17, BUG-07; split from BookCare on 25 Nov 2026) */
export default async function ProjectsPage() {
  const { rows } = await listProjects("", "all");
  return <ProjectsTable rows={rows} />;
}
