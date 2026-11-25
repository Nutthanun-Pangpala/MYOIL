export type Role = "store_admin" | "project_viewer" | "executive" | "system_admin" | "driver";

export const roleLabel: Record<Role, string> = {
  store_admin: "แอดมินสโตร์กลาง",
  project_viewer: "ผู้ดูโครงการ",
  executive: "ผู้บริหาร",
  system_admin: "ผู้ดูแลระบบ",
  driver: "คนขับรถเติมน้ำมัน",
};
