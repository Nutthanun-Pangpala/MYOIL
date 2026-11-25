import { listProjects } from "@/server/settings/settings-service";
import { SettingsHeader } from "../settings-header";
import { ProjectsTable } from "./projects-table";

export const metadata = { title: "โครงการ" };

/** design 6.11 โครงการ: read-only, the list comes from BookCare */
export default async function ProjectsPage() {
  const { rows } = await listProjects("", "all");
  return (
    <>
      <SettingsHeader />
      <div className="flex flex-col gap-4">
        <p className="rounded-control border border-line bg-card px-[18px] py-3.5">
          <strong>รายชื่อโครงการมาจาก BookCare</strong> MYOIL ดูได้อย่างเดียว ถ้าต้องเพิ่มโครงการ แก้ชื่อ หรือปิดโครงการ ให้ทำใน BookCare แล้วรายชื่อในหน้านี้จะเปลี่ยนตามเอง
        </p>
        <ProjectsTable rows={rows} />
      </div>
    </>
  );
}
