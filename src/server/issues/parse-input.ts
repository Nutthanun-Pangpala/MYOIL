import type { IssueInput, IssueLineInput } from "@/domain/issue-check";

/**
 * Server actions receive whatever a browser sends. This turns it into a well-formed IssueInput
 * (right types, bounded sizes) before any rule or query sees it. Garbage becomes empty values,
 * which the rules then report as ordinary field errors.
 */

const MAX_LINES = 30;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const time = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : "");
const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export function parseIssueInput(raw: unknown): IssueInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lines: IssueLineInput[] = (Array.isArray(r.lines) ? r.lines : []).slice(0, MAX_LINES).map((l) => {
    const o = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
    return { machine: str(o.machine, 100), hourMeter: num(o.hourMeter), liters: num(o.liters) };
  });
  return {
    bookNo: str(r.bookNo, 20),
    docNo: str(r.docNo, 20),
    issueDate: isoDate(r.issueDate),
    projectId: typeof r.projectId === "string" && /^[0-9a-f-]{36}$/i.test(r.projectId) ? r.projectId : null,
    timeIn: time(r.timeIn),
    timeOut: time(r.timeOut),
    fuelDriver: str(r.fuelDriver, 100),
    machineDriver: str(r.machineDriver, 100),
    lines,
    receivedSigned: r.receivedSigned === true,
    receiverName: str(r.receiverName, 100),
  };
}
