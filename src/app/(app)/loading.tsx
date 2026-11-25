import { Card, SkeletonRows } from "@/components/ui";

/** design "กำลังโหลด": the menu stays, the page shows grey bars shaped like its table — no spinner over the whole page */
export default function Loading() {
  return (
    <>
      <div className="flex flex-col gap-2.5" aria-hidden>
        <span className="skeleton w-64 max-w-full" style={{ height: 34 }} />
        <span className="skeleton w-96 max-w-full" />
      </div>
      <Card className="p-6">
        <SkeletonRows rows={6} label="กำลังโหลดข้อมูล" />
      </Card>
    </>
  );
}
