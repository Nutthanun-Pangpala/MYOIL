import { describe, expect, it } from "vitest";
import { canChangeStop, checkStopForIssue, moveStop, renumber, stopStatus } from "./route";

describe("stopStatus", () => {
  it("a slip fills, a cancelled slip doesn't, a fill wins over a skip", () => {
    expect(stopStatus({ issueId: null, issueCancelled: false, skipRef: null })).toBe("pending");
    expect(stopStatus({ issueId: "i", issueCancelled: false, skipRef: null })).toBe("filled");
    expect(stopStatus({ issueId: "i", issueCancelled: true, skipRef: null })).toBe("pending");
    expect(stopStatus({ issueId: null, issueCancelled: false, skipRef: "k" })).toBe("skipped");
    expect(stopStatus({ issueId: "i", issueCancelled: false, skipRef: "k" })).toBe("filled");
  });
  it("only a filled stop is locked", () => {
    expect(canChangeStop("pending")).toBe(true);
    expect(canChangeStop("skipped")).toBe(true);
    expect(canChangeStop("filled")).toBe(false);
  });
});

describe("order", () => {
  const stops = [
    { id: "a", position: 1 },
    { id: "b", position: 3 },
    { id: "c", position: 7 },
  ];
  it("renumbers 1..n", () => expect(renumber(stops).map((s) => s.position)).toEqual([1, 2, 3]));
  it("moves a stop up or down, not past the ends", () => {
    expect(moveStop(stops, "b", -1).map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(moveStop(stops, "b", 1).map((s) => s.id)).toEqual(["a", "c", "b"]);
    expect(moveStop(stops, "a", -1).map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(moveStop(stops, "c", 1).map((s) => s.position)).toEqual([1, 2, 3]);
  });
});

describe("checkStopForIssue (API 1)", () => {
  const stop = { projectRefCode: "PCOB", status: "pending" as const, routeDate: "2026-11-23" };
  const slip = { projectRefCode: "PCOB", issueDate: "2026-11-23" };
  it("refuses a slip with no stop", () => expect(checkStopForIssue(null, slip)).toMatchObject({ ok: false, status: 400, code: "no_route_stop" }));
  it("the project and the day must match the stop", () => {
    expect(checkStopForIssue(stop, { ...slip, projectRefCode: "PNKK" })).toMatchObject({ ok: false, code: "invalid", field: "routeStopId" });
    expect(checkStopForIssue(stop, { ...slip, issueDate: "2026-11-24" })).toMatchObject({ ok: false, code: "invalid" });
  });
  it("one slip per stop", () => expect(checkStopForIssue({ ...stop, status: "filled" }, slip)).toMatchObject({ ok: false, status: 409, code: "stop_filled" }));
  it("a skipped stop can still be filled, and says so", () => {
    expect(checkStopForIssue(stop, slip)).toEqual({ ok: true, wasSkipped: false });
    expect(checkStopForIssue({ ...stop, status: "skipped" }, slip)).toEqual({ ok: true, wasSkipped: true });
  });
});
