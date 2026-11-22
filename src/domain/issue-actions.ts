/** Rules for changing a slip after it was saved (edit, sign, cancel). Pure. */

/** null = can be changed; otherwise the reason in plain Thai */
export function changeLock(s: { cancelled: boolean; closedCycleLabel: string | null }): string | null {
  if (s.cancelled) return "ใบนี้ถูกยกเลิกแล้ว กด “นำกลับมา” ก่อนจึงจะแก้ได้";
  if (s.closedCycleLabel) return `ใบนี้อยู่ในรอบ ${s.closedCycleLabel} ที่ปิดแล้ว ต้องให้ผู้ดูแลระบบเปิดรอบอีกครั้งก่อน`;
  return null;
}

export function cancelReasonError(reason: string): string | null {
  return reason.trim() ? null : "ใส่เหตุผลที่ยกเลิก";
}
