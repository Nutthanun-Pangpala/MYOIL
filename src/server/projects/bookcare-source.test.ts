import { describe, expect, it } from "vitest";
import { ProjectSourceError, toProjectRecords } from "./bookcare-source";

const row = (o: Partial<Record<string, unknown>> = {}) => ({ ref_code: "PNKK", project_code: "P001", name: "โครงการ A", is_active: true, ...o });

describe("toProjectRecords", () => {
  it("maps the 4 columns and trims", () => {
    expect(toProjectRecords([row({ ref_code: " PNKK ", project_code: " ", is_active: false })])).toEqual([
      { refCode: "PNKK", projectCode: null, name: "โครงการ A", isActive: false },
    ]);
  });
  it("refuses an empty list (it would close every project)", () => {
    expect(() => toProjectRecords([])).toThrow(ProjectSourceError);
  });
  it("refuses a row with no ref code or name", () => {
    expect(() => toProjectRecords([row({ ref_code: "" })])).toThrow(/แถวที่ 1/);
    expect(() => toProjectRecords([row(), row({ ref_code: "X", name: null })])).toThrow(/แถวที่ 2/);
  });
  it("refuses a repeated ref code", () => {
    expect(() => toProjectRecords([row(), row()])).toThrow(/ซ้ำ/);
  });
  it("same accounting code on two projects is fine", () => {
    expect(toProjectRecords([row(), row({ ref_code: "OTHER" })])).toHaveLength(2);
  });
});
