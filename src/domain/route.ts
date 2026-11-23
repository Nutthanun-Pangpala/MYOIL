/**
 * Route of the fuel truck (brief R20–R23, contract §9.1). Pure: no database, no clock.
 * One route per day, stops in the admin's order, one slip per stop.
 */

export type StopStatus = "pending" | "filled" | "skipped";

/** a slip that isn't cancelled fills the stop (a fill wins over an earlier skip); a skip without a slip skips it */
export function stopStatus(s: { issueId: string | null; issueCancelled: boolean; skipRef: string | null }): StopStatus {
  if (s.issueId && !s.issueCancelled) return "filled";
  if (s.skipRef) return "skipped";
  return "pending";
}

/** "แก้ระหว่างวัน": a stop that has its slip is locked; pending or skipped ones can be moved, edited or removed */
export const canChangeStop = (status: StopStatus) => status !== "filled";

export type StopRef = { id: string; position: number };

/** positions 1..n in the current order (after a remove or an insert) */
export function renumber<T extends StopRef>(stops: T[]): T[] {
  return [...stops].sort((a, b) => a.position - b.position).map((s, i) => ({ ...s, position: i + 1 }));
}

/** swap a stop with its neighbour ("ขึ้น" = -1, "ลง" = +1). Unchanged when it is already at that end */
export function moveStop<T extends StopRef>(stops: T[], id: string, dir: -1 | 1): T[] {
  const list = renumber(stops);
  const i = list.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  [list[i], list[j]] = [list[j], list[i]];
  return list.map((s, k) => ({ ...s, position: k + 1 }));
}

export type IssueStopCheck = { ok: true; wasSkipped: boolean } | { ok: false; status: 400 | 409; code: string; message: string; field?: string };

/** may this phone slip fill this stop? (contract §9.1, API 1) */
export function checkStopForIssue(
  stop: { projectRefCode: string; status: StopStatus; routeDate: string } | null,
  slip: { projectRefCode: string; issueDate: string },
): IssueStopCheck {
  if (!stop) return { ok: false, status: 400, code: "no_route_stop", message: "ใบนี้ไม่มีจุดในเส้นทางรองรับ แอดมินต้องวางเส้นทางก่อน", field: "routeStopId" };
  if (stop.projectRefCode !== slip.projectRefCode) return { ok: false, status: 400, code: "invalid", message: `โครงการของใบ (${slip.projectRefCode}) ไม่ตรงกับจุดในเส้นทาง (${stop.projectRefCode})`, field: "routeStopId" };
  if (stop.routeDate !== slip.issueDate) return { ok: false, status: 400, code: "invalid", message: "วันที่ของใบไม่ตรงกับวันของเส้นทาง", field: "routeStopId" };
  if (stop.status === "filled") return { ok: false, status: 409, code: "stop_filled", message: "จุดนี้มีใบจ่ายแล้ว (1 จุด 1 ใบ)" };
  return { ok: true, wasSkipped: stop.status === "skipped" };
}
