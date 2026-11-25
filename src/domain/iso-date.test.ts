import { describe, expect, it } from "vitest";
import { addDays, isMonth, monthOf, monthRange, monthUpTo, shiftMonth, isIsoDate } from "./iso-date";

describe("iso-date", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("month range knows leap years", () => {
    expect(monthRange("2026-11")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(monthRange("2028-02").end).toBe("2028-02-29");
  });
  it("shifts months over year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", 2)).toBe("2027-01");
    expect(shiftMonth("2026-11", 0)).toBe("2026-11");
  });
  // BUG-05 (test round 10): the overview says "นับถึงวันนี้", so a slip dated later this month is not counted yet
  it("monthUpTo stops at today in this month, takes a past month whole", () => {
    expect(monthUpTo("2026-11", "2026-11-24")).toEqual({ start: "2026-11-01", end: "2026-11-24" });
    expect(monthUpTo("2026-10", "2026-11-24")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(monthUpTo("2026-11", "2026-11-30")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });
  it("monthUpTo of a month that has not started is empty (ends before it starts)", () => {
    const r = monthUpTo("2026-12", "2026-11-24");
    expect(r.end < r.start).toBe(true);
  });
  it("monthOf / isMonth", () => {
    expect(monthOf("2026-11-17")).toBe("2026-11");
    expect(isMonth("2026-11")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("26-11")).toBe(false);
  });
});

describe("isIsoDate", () => {
  it("accepts a real calendar day", () => {
    expect(isIsoDate("2026-11-30")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });
  it("rejects days that do not exist or are not ISO", () => {
    expect(isIsoDate("2026-11-31")).toBe(false);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("21/11/69")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});
