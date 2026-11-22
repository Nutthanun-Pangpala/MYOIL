import { describe, expect, it } from "vitest";
import { projectBreakdown, tankLevel } from "./overview";

describe("tankLevel", () => {
  it("is ok above the low mark", () => {
    const t = tankLevel(1665, 6000, 1200);
    expect(t.status).toBe("ok");
    expect(t.percent).toBe(28);
    expect(t.text).toBe("1,665");
  });
  it("is low at or under the low mark", () => {
    expect(tankLevel(1200, 6000, 1200).status).toBe("low");
  });
  it("defaults the low mark to 20% of the tank", () => {
    expect(tankLevel(1199, 6000, null).status).toBe("low");
    expect(tankLevel(1201, 6000, null).status).toBe("ok");
  });
  it("is negative below zero and never shows a negative fill", () => {
    const t = tankLevel(-229, 6000, null);
    expect(t.status).toBe("negative");
    expect(t.percent).toBe(0);
    expect(t.text).toBe("-229");
  });
  it("needs no capacity: percent is null", () => {
    const t = tankLevel(500, null, null);
    expect(t.percent).toBeNull();
    expect(t.status).toBe("ok");
    expect(tankLevel(50, null, 1200).status).toBe("ok");
  });
  it("rounds half-litres for the big number", () => {
    expect(tankLevel(1665.5, 6000, null).text).toBe("1,666");
  });
});

describe("projectBreakdown", () => {
  const rows = [
    { issueId: "a", projectKey: "p1", projectLabel: "P1", liters: 100, amount: 4000 },
    { issueId: "a", projectKey: "p1", projectLabel: "P1", liters: 50, amount: 2000 },
    { issueId: "b", projectKey: "p1", projectLabel: "P1", liters: 50, amount: null },
    { issueId: "c", projectKey: "p2", projectLabel: "P2", liters: 100, amount: 4000.5 },
  ];
  const b = projectBreakdown(rows);
  it("sorts by liters, biggest first, ties by label", () => {
    expect(b.rows.map((r) => r.label)).toEqual(["P1", "P2"]);
  });
  it("counts slips, not lines", () => {
    expect(b.rows[0].slips).toBe(2);
    expect(b.slips).toBe(3);
  });
  it("sums liters and amount (waiting-price lines add no money)", () => {
    expect(b.rows[0].liters).toBe(200);
    expect(b.rows[0].amount).toBe(6000);
    expect(b.liters).toBe(300);
    expect(b.amount).toBe(10000.5);
  });
  it("compares each project with the biggest, in whole percent", () => {
    expect(b.rows.map((r) => r.pct)).toEqual([100, 50]);
  });
  it("copes with no rows", () => {
    expect(projectBreakdown([])).toEqual({ rows: [], liters: 0, amount: 0, unsignedAmount: 0, slips: 0 });
  });
});

describe("projectBreakdown: unsigned money", () => {
  it("splits out the money on slips not yet signed for", () => {
    const b = projectBreakdown([
      { issueId: "a", projectKey: "p1", projectLabel: "P1", liters: 100, amount: 4000, signed: true },
      { issueId: "b", projectKey: "p1", projectLabel: "P1", liters: 50, amount: 2000.5, signed: false },
      { issueId: "c", projectKey: "p1", projectLabel: "P1", liters: 10, amount: null, signed: false },
    ]);
    expect(b.amount).toBe(6000.5);
    expect(b.unsignedAmount).toBe(2000.5);
  });
});
