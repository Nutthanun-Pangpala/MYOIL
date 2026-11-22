import { Card } from "./ui";

/** placeholder for a screen that is designed but not built yet */
export function ComingSoon({ title, brief }: { title: string; brief: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl text-earth">{title}</h1>
      <Card className="p-6 text-muted">ยังไม่ได้สร้างหน้านี้ — {brief}</Card>
    </div>
  );
}
