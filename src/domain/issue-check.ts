import { TWO_DECIMALS_MESSAGE, hasAtMostTwoDecimals } from "./money";
import { receiverNameError } from "./rules";

/**
 * Checks for one fuel issue slip while it is keyed (brief §7). Pure: the service loads the
 * context (duplicates, closed cycle, history) and passes it in; the form shows the same result live.
 * errors block saving; warnings never do.
 */

export type IssueLineInput = {
  machine: string; // code or plate as typed
  hourMeter: number | null;
  liters: number | null;
};

export type IssueInput = {
  bookNo: string;
  docNo: string;
  issueDate: string; // ISO or ""
  projectId: string | null;
  timeIn: string; // "HH:MM" or ""
  timeOut: string;
  fuelDriver: string; // พขร.เติมน้ำมัน
  machineDriver: string; // พขร.ดูแลเครื่องจักร
  lines: IssueLineInput[];
  receivedSigned: boolean;
  receiverName: string;
};

export type MachineHistory = {
  lastHourMeter: { value: number; date: string } | null;
  maxLiters: number | null;
  fills: number; // how many earlier fills the max is based on
};

export type IssueContext = {
  /** id of an existing slip with the same book+doc (excluding the one being edited) */
  duplicateIssueId: string | null;
  /** label like "ก.ย. 2569" when the date falls in a closed cycle */
  closedCycleLabel: string | null;
  /** by machineKey(machine) */
  history: Record<string, MachineHistory>;
};

export type IssueErrors = {
  book?: string;
  doc?: string;
  date?: string;
  project?: string;
  receiver?: string;
  form?: string;
  lines: Record<number, { machine?: string; liters?: string }>;
};

export type IssueWarning = {
  kind: "hours" | "liters" | "unsigned";
  line?: number;
  message: string;
};

export type IssueCheck = { ok: boolean; errors: IssueErrors; warnings: IssueWarning[] };

/** A fill this many times the biggest earlier fill (with enough history) is flagged. */
export const LITER_WARN_FACTOR = 2;
export const LITER_WARN_MIN_FILLS = 3;

/** same machine however it was typed: trim, collapse spaces, ignore case */
export const machineKey = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export function checkIssue(input: IssueInput, ctx: IssueContext): IssueCheck {
  const errors: IssueErrors = { lines: {} };
  const warnings: IssueWarning[] = [];

  if (!input.bookNo.trim()) errors.book = "ใส่เล่มที่";
  if (!input.docNo.trim()) errors.doc = "ใส่เลขที่";
  else if (ctx.duplicateIssueId) errors.doc = "เล่มที่และเลขที่นี้มีอยู่แล้วในระบบ";

  if (!input.issueDate) errors.date = "ใส่วันที่";
  else if (ctx.closedCycleLabel) {
    errors.date = `วันที่นี้อยู่ในรอบ ${ctx.closedCycleLabel} ที่ปิดแล้ว ต้องให้ผู้ดูแลระบบเปิดรอบอีกครั้งก่อน`;
  }

  if (!input.projectId) errors.project = "ยังไม่ได้เลือกโครงการ";

  const rec = receiverNameError(input.receivedSigned, input.receiverName);
  if (rec) errors.receiver = "ติ๊กว่าใบมีลายเซ็นแล้ว ต้องใส่ชื่อผู้เซ็นรับ";

  if (input.lines.length === 0) errors.form = "ต้องมีรายการเครื่องจักรอย่างน้อย 1 บรรทัด";

  input.lines.forEach((l, i) => {
    const le: { machine?: string; liters?: string } = {};
    if (!l.machine.trim()) le.machine = "ใส่รายการหรือรหัสเครื่องจักร";
    if (l.liters === null || !Number.isFinite(l.liters) || l.liters <= 0) le.liters = "ลิตรต้องมากกว่า 0";
    else if (!hasAtMostTwoDecimals(l.liters)) le.liters = TWO_DECIMALS_MESSAGE;
    if (le.machine || le.liters) errors.lines[i] = le;

    const h = ctx.history[machineKey(l.machine)];
    if (h && l.hourMeter !== null && h.lastHourMeter && l.hourMeter < h.lastHourMeter.value) {
      warnings.push({
        kind: "hours",
        line: i,
        message: `น้อยกว่าครั้งก่อนของ ${l.machine.trim()} (${h.lastHourMeter.value} เมื่อ ${h.lastHourMeter.date})`,
      });
    }
    if (
      h &&
      h.maxLiters !== null &&
      h.fills >= LITER_WARN_MIN_FILLS &&
      l.liters !== null &&
      l.liters > h.maxLiters * LITER_WARN_FACTOR
    ) {
      warnings.push({
        kind: "liters",
        line: i,
        message: `สูงกว่าที่ ${l.machine.trim()} เคยเติมมาก ครั้งก่อน ๆ ไม่เกิน ${h.maxLiters} ลิตร`,
      });
    }
  });

  if (!input.receivedSigned) {
    warnings.push({
      kind: "unsigned",
      message: "ใบนี้จะติดป้าย ยังไม่เซ็นรับ และไม่นับเข้าใบแจ้งค่าใช้จ่ายจนกว่าจะเซ็น",
    });
  }

  const hasError =
    !!(errors.book || errors.doc || errors.date || errors.project || errors.receiver || errors.form) ||
    Object.keys(errors.lines).length > 0;
  return { ok: !hasError, errors, warnings };
}

/** the next slip number after "11445" → "11446"; keeps leading zeros; non-numeric → "" */
export function nextDocNo(docNo: string): string {
  const m = /^(\D*)(\d+)$/.exec(docNo.trim());
  if (!m) return "";
  const next = String(BigInt(m[2]) + 1n).padStart(m[2].length, "0");
  return m[1] + next;
}
