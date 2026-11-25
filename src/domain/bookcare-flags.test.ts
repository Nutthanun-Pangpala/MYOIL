import { describe, expect, it } from "vitest";
import { flagLabel, withDateFlags } from "./bookcare-flags";

describe("flagLabel", () => {
  it("puts the line number in front of line flags", () => {
    expect(flagLabel("new_machine:3")).toMatch(/^บรรทัด 3: /);
    expect(flagLabel("high_liters:1")).toMatch(/^บรรทัด 1: /);
  });
  it("words the plain flags", () => {
    expect(flagLabel("late")).toContain("รอบถัดไป");
    expect(flagLabel("over_balance")).toContain("ติดลบ");
  });
  it("shows an unknown code as it is", () => expect(flagLabel("something_new")).toBe("something_new"));
});

// OBS-25 (test round 10): a phone with its clock 3 days ahead sent a slip dated 27 Nov on 24 Nov
describe("withDateFlags", () => {
  it("adds dated_ahead when the slip is dated after the Bangkok day it reached MYOIL", () => {
    expect(withDateFlags(["over_balance"], "2026-11-27", "2026-11-24T09:37:00.000Z")).toEqual(["over_balance", "dated_ahead"]);
  });
  it("leaves a slip of that day or before alone", () => {
    expect(withDateFlags([], "2026-11-24", "2026-11-24T09:37:00.000Z")).toEqual([]);
    expect(withDateFlags([], "2026-11-20", "2026-11-24T09:37:00.000Z")).toEqual([]);
  });
  it("counts the arrival day in Bangkok time", () => {
    // 17:30 UTC on the 24th is 00:30 on the 25th in Bangkok, so a slip of the 25th is not ahead
    expect(withDateFlags([], "2026-11-25", "2026-11-24T17:30:00.000Z")).toEqual([]);
  });
  it("says nothing without an arrival time", () => expect(withDateFlags(["late"], "2026-11-27", null)).toEqual(["late"]));
  it("words it for the office", () => expect(flagLabel("dated_ahead")).toContain("นาฬิกา"));
});
