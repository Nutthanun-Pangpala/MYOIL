import { describe, expect, it } from "vitest";
import { byMachine, byProject, daysIn, type MonthlyLine } from "./monthly-matrix";

const L = (date: string, project: string, machine: string, liters: number, extra: Partial<MonthlyLine> = {}): MonthlyLine => ({
  date,
  projectKey: project,
  projectLabel: project,
  machineKey: machine,
  machineLabel: machine,
  assetCode: null,
  isRented: false,
  liters,
  ...extra,
});

describe("daysIn", () => {
  it("knows the length of a month", () => {
    expect(daysIn("2026-11")).toBe(30);
    expect(daysIn("2026-02")).toBe(28);
    expect(daysIn("2028-02")).toBe(29);
  });
});

describe("byProject", () => {
  const lines = [
    L("2026-11-03", "PCOB", "PC210", 129),
    L("2026-11-03", "PCOB", "FL022", 0.1),
    L("2026-11-03", "PCOB", "FL022", 0.2),
    L("2026-11-08", "PCOB", "PC210", 332),
    L("2026-11-03", "ตย.02", "PC210", 260),
  ];
  const m = byProject(lines, "2026-11");
  it("puts liters of each project on its day, 0 where nothing was issued", () => {
    const p = m.rows.find((r) => r.key === "PCOB")!;
    expect(p.days).toHaveLength(30);
    expect(p.days[2]).toBe(129.3);
    expect(p.days[7]).toBe(332);
    expect(p.days[0]).toBe(0);
    expect(p.total).toBe(461.3);
  });
  it("sums without float drift (0.1 + 0.2)", () => {
    expect(m.rows.find((r) => r.key === "PCOB")!.days[2]).toBe(129.3);
  });
  it("adds a total per day and a grand total", () => {
    expect(m.dayTotals[2]).toBe(389.3);
    expect(m.grandTotal).toBe(721.3);
  });
  it("ignores lines outside the month", () => {
    const x = byProject([...lines, L("2026-12-01", "PCOB", "PC210", 999), L("2026-10-31", "PCOB", "PC210", 999)], "2026-11");
    expect(x.grandTotal).toBe(721.3);
  });
  it("lists a project only when it has liters", () => {
    expect(m.rows.map((r) => r.key)).toEqual(["PCOB", "ตย.02"]);
  });
});

describe("byMachine", () => {
  const lines = [
    L("2026-11-03", "PCOB", "PC210", 129, { assetCode: "A-1" }),
    L("2026-11-08", "PCOB", "PC30 เช่า", 100, { isRented: true }),
    L("2026-11-08", "PCOB", "PC210", 5),
    L("2026-11-09", "XXX", "PC210", 777),
  ];
  const m = byMachine(lines, "PCOB", "2026-11");
  it("shows only the chosen project, one row per machine, numbered", () => {
    expect(m.rows.map((r) => [r.no, r.label, r.assetCode, r.isRented, r.total])).toEqual([
      [1, "PC210", "A-1", false, 134],
      [2, "PC30 เช่า", null, true, 100],
    ]);
  });
  it("totals per day and overall", () => {
    expect(m.dayTotals[7]).toBe(105);
    expect(m.grandTotal).toBe(234);
  });
});
