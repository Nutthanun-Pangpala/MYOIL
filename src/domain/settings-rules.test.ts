import { describe, expect, it } from "vitest";
import { validateCycleDates, validateMachine, validateTank, validateUser } from "./settings-rules";

const prev = { start: "2026-10-01", end: "2026-10-31" };
const next = { start: "2027-01-01", end: "2027-01-31" };

describe("validateCycleDates", () => {
  it("accepts a change that keeps cycles joined", () => {
    expect(validateCycleDates({ prev, next, start: "2026-11-01", end: "2026-12-20" })).toBeNull();
  });
  it("start must be the day after the previous cycle's end", () => {
    expect(validateCycleDates({ prev, next, start: "2026-11-02", end: "2026-12-31" })).toContain("วันถัดจาก");
  });
  it("end cannot be before start", () => {
    expect(validateCycleDates({ prev, next: null, start: "2026-11-01", end: "2026-10-30" })).toContain("ก่อนวันเริ่ม");
  });
  it("end must leave at least one day for the next cycle", () => {
    expect(validateCycleDates({ prev, next, start: "2026-11-01", end: "2027-01-31" })).toContain("รอบถัดไป");
  });
  it("rejects a bad date", () => {
    expect(validateCycleDates({ prev, next, start: "2026-11-31", end: "2026-12-31" })).toContain("วันที่");
  });
});

describe("validateTank", () => {
  it("accepts sensible numbers", () => {
    expect(validateTank({ capacity: 6000, low: 1200, opening: 380, openingDate: "2026-11-01" })).toEqual({});
  });
  it("low mark cannot exceed capacity", () => {
    expect(validateTank({ capacity: 1000, low: 2000, opening: 0, openingDate: null }).low).toBeDefined();
  });
  it("capacity must be above zero when given; empty is allowed (not known yet)", () => {
    expect(validateTank({ capacity: 0, low: null, opening: 0, openingDate: null }).capacity).toBeDefined();
    expect(validateTank({ capacity: null, low: null, opening: 0, openingDate: null })).toEqual({});
  });
  it("opening balance is not negative and has at most 2 decimals", () => {
    expect(validateTank({ capacity: null, low: null, opening: -1, openingDate: null }).opening).toBeDefined();
    expect(validateTank({ capacity: null, low: null, opening: 1.234, openingDate: null }).opening).toBeDefined();
  });
});

describe("validateUser", () => {
  const ok = { name: "สมชาย", email: "a@b.co", role: "store_admin", projectIds: [] as string[], password: "abcd1234" };
  it("accepts a complete user", () => {
    expect(validateUser(ok)).toEqual({});
  });
  it("a project viewer needs at least one project", () => {
    expect(validateUser({ ...ok, role: "project_viewer" }).projects).toBeDefined();
    expect(validateUser({ ...ok, role: "project_viewer", projectIds: ["x"] }).projects).toBeUndefined();
  });
  it("says every problem at once", () => {
    const e = validateUser({ ...ok, name: " ", email: "nope", password: "123" });
    expect(Object.keys(e).sort()).toEqual(["email", "name", "password"]);
  });
});

describe("validateMachine", () => {
  it("needs a code", () => {
    expect(validateMachine({ code: "  " }).code).toBeDefined();
    expect(validateMachine({ code: "PC210" })).toEqual({});
  });
  it("refuses a code longer than 60 characters instead of cutting it (BUG-06)", () => {
    expect(validateMachine({ code: "A".repeat(60) })).toEqual({});
    expect(validateMachine({ code: "A".repeat(61) }).code).toContain("ไม่เกิน 60 ตัวอักษร");
  });
});
