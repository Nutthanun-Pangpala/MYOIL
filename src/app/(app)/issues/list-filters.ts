import { isIsoDate } from "@/domain/iso-date";
import { ISSUE_STATES, type IssueFilters, type IssueState } from "@/server/issues/issue-service";

type Get = (k: string) => string;

/** the list's address → filters; the screen and its Excel export read it the same way */
export function issueFiltersFrom(get: Get): IssueFilters & { badDate: boolean } {
  const rawFrom = get("from"), rawTo = get("to");
  const st = get("status");
  // the dropdown sends ?status=<state>; old links used status=cancelled|active and signed=no / review=pending
  const state = (ISSUE_STATES as readonly string[]).includes(st) ? (st as IssueState) : undefined;
  return {
    from: isIsoDate(rawFrom) ? rawFrom : undefined,
    to: isIsoDate(rawTo) ? rawTo : undefined,
    badDate: (rawFrom !== "" && !isIsoDate(rawFrom)) || (rawTo !== "" && !isIsoDate(rawTo)),
    projectId: get("project") || undefined,
    q: get("q") || undefined,
    machine: get("machine") || undefined,
    unsigned: get("signed") === "no",
    status: st === "active" ? "active" : undefined,
    state,
    review: get("review") === "pending" ? "pending" : undefined,
  };
}

/** the dropdown's words */
export const STATE_LABEL: Record<IssueState, string> = {
  normal: "ปกติ",
  unsigned: "ยังไม่เซ็นรับ",
  pending_price: "รอราคา",
  pending_review: "รอตรวจ",
  invoiced: "อยู่ในใบแจ้งแล้ว",
  cancelled: "ยกเลิก",
};
