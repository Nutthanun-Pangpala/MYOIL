/**
 * Which fuel issues (ใบจ่าย) count where. One place, so the balance book, the monthly
 * table and the invoice can never disagree. Brief §7 / BA decision 22 Nov 2026.
 */

export type IssueState = {
  cancelled: boolean;
  /** ticked by the admin: the paper copy has the project store's signature */
  receivedSigned: boolean;
  /** a slip from the phone is invoiced only after an admin pressed "ตรวจแล้ว"; paper slips leave this out */
  reviewed?: boolean;
};

/** สมุดคงเหลือ: every issue that is not cancelled, signed or not */
export const countsInBalance = (i: IssueState) => !i.cancelled;

/** ตารางรายเดือน: same as the balance book */
export const countsInMonthly = (i: IssueState) => !i.cancelled;

/** ใบแจ้งค่าใช้จ่าย: only signed (and, from the phone, checked), not cancelled */
export const countsInInvoice = (i: IssueState) => !i.cancelled && i.receivedSigned && i.reviewed !== false;

/** The receiver's name is required only when the paper copy is ticked as signed. */
export function receiverNameError(receivedSigned: boolean, receiverName: string | null | undefined): string | null {
  if (receivedSigned && !(receiverName ?? "").trim()) return "ใส่ชื่อผู้เซ็นรับ";
  return null;
}
