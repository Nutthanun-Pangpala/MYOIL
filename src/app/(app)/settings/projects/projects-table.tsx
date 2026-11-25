"use client";

import { useState } from "react";
import { Card, Pill, ProjectChip, StateBox, fieldClass } from "@/components/ui";

type Row = { id: string; ref: string; code: string | null; name: string; active: boolean };

/** search filters as you type (design: "ผลขึ้นทันที"); 40-odd projects, so the whole list is already here */
export function ProjectsTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = term ? rows.filter((p) => `${p.ref} ${p.code ?? ""} ${p.name}`.toLowerCase().includes(term)) : rows;
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex max-w-[360px] flex-col gap-1.5">
        <label htmlFor="s-q" className="text-sm">
          ค้นหาโครงการ
        </label>
        <input id="s-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์รหัสหรือชื่อ ผลขึ้นทันที" className={fieldClass} />
      </div>
      {rows.length === 0 ? (
        <StateBox title="ยังไม่มีรายชื่อโครงการจาก BookCare">รายชื่อจะขึ้นที่นี่หลัง BookCare ส่งรายชื่อโครงการมา</StateBox>
      ) : shown.length === 0 ? (
        <StateBox title="ไม่พบโครงการที่ตรงกับคำค้น">ลองพิมพ์รหัสโครงการ รหัสบัญชี หรือบางส่วนของชื่อ</StateBox>
      ) : (
        <div className="overflow-x-auto">
          <table className="t">
            <thead>
              <tr>
                <th>รหัสโครงการ</th>
                <th>รหัสบัญชี</th>
                <th>ชื่อโครงการ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <ProjectChip code={p.ref} name={p.name} />
                  </td>
                  <td className="text-muted">{p.code ?? "–"}</td>
                  <td className="text-muted">{p.name}</td>
                  <td>
                    <Pill tone={p.active ? "ok" : "off"}>{p.active ? "เปิด" : "ปิด"}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[14px] text-muted">
        แสดง {shown.length} จาก {rows.length} โครงการ โครงการที่ปิดแล้วเลือกในใบจ่ายใหม่ไม่ได้
      </p>
    </Card>
  );
}
