import { Card, SkeletonRows } from "@/components/ui";
import { SettingsHeader } from "./settings-header";

/** design "กำลังโหลด": title and tabs stay, the tab shows grey bars shaped like its table — no spinner over the whole page */
export default function Loading() {
  return (
    <>
      <SettingsHeader />
      <Card className="p-6">
        <SkeletonRows rows={6} label="กำลังโหลดข้อมูล" />
      </Card>
    </>
  );
}
