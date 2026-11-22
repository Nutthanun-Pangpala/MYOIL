import { describe, expect, it } from "vitest";
import { cancelReasonError, changeLock } from "./issue-actions";

describe("changeLock — when a slip can no longer be changed", () => {
  it("open slip can be changed", () => {
    expect(changeLock({ cancelled: false, closedCycleLabel: null })).toBeNull();
  });
  it("slip in a closed cycle is locked and names the cycle", () => {
    expect(changeLock({ cancelled: false, closedCycleLabel: "ก.ย. 2569" })).toContain("ก.ย. 2569");
  });
  it("cancelled slip is locked for editing (restore first)", () => {
    expect(changeLock({ cancelled: true, closedCycleLabel: null })).toContain("นำกลับมา");
  });
});

describe("cancelReasonError", () => {
  it("needs a reason", () => {
    expect(cancelReasonError("")).not.toBeNull();
    expect(cancelReasonError("   ")).not.toBeNull();
    expect(cancelReasonError("คีย์ซ้ำ")).toBeNull();
  });
});
