import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "./settings-tabs";

/** design 6.11: every tab starts with the same title and tabs; a tab may put its one button on the right of the title */
export function SettingsHeader({ actions }: { actions?: ReactNode }) {
  return (
    <>
      <PageHeader title="ตั้งค่า" sub="ข้อมูลหลักที่ผู้ดูแลระบบดูแล" actions={actions} />
      <SettingsTabs />
    </>
  );
}
