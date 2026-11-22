import { Card, Pill, linkButton } from "@/components/ui";
import { listProjects } from "@/server/settings/settings-service";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ProjectsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q);
  const status = (["open", "closed"].includes(one(sp.status)) ? one(sp.status) : "all") as "all" | "open" | "closed";
  const { rows, total } = await listProjects(q, status);
  const input = "h-11 rounded-control border border-line bg-card px-3 text-[15px]";
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px]">รายชื่อโครงการมาจาก BookCare MYOIL ดูได้อย่างเดียว ถ้าต้องเพิ่มโครงการ แก้ชื่อ หรือปิดโครงการ ให้ทำใน BookCare แล้วรายชื่อในหน้านี้จะเปลี่ยนตามเอง</p>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          ค้นหาโครงการ
          <input type="search" name="q" defaultValue={q} placeholder="รหัส ชื่อ หรือรหัสบัญชี" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          สถานะ
          <select name="status" defaultValue={status} className={input}>
            <option value="all">ทั้งหมด</option>
            <option value="open">เปิด</option>
            <option value="closed">ปิด</option>
          </select>
        </label>
        <button type="submit" className={linkButton()}>
          ค้นหา
        </button>
      </form>
      <Card className="overflow-x-auto p-2">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-muted">{total === 0 ? "ยังไม่มีรายชื่อโครงการจาก BookCare" : "ไม่พบโครงการที่ตรงกับคำค้น"}</p>
        ) : (
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="text-left text-muted">
                {["รหัสโครงการ", "รหัสบัญชี", "ชื่อโครงการ", "สถานะ"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-3 py-3 font-medium">{p.ref}</td>
                  <td className="px-3 py-3">{p.code ?? "–"}</td>
                  <td className="px-3 py-3">{p.name}</td>
                  <td className="px-3 py-3">
                    <Pill tone={p.active ? "ok" : "bad"}>{p.active ? "เปิด" : "ปิด"}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-[13px] text-muted">แสดง {rows.length} จาก {total} โครงการ โครงการที่ปิดแล้วเลือกในใบจ่ายใหม่ไม่ได้</p>
    </div>
  );
}
