import { describe, expect, it } from "vitest";
import { buildLedger, stockDifference } from "./ledger";

describe("buildLedger", () => {
  it("carries the closing balance into the next day's opening", () => {
    const rows = buildLedger({
      openingLiters: 1000,
      from: "2026-11-01",
      to: "2026-11-03",
      purchases: [{ date: "2026-11-02", liters: 500 }],
      issues: [
        { date: "2026-11-01", liters: 200 },
        { date: "2026-11-02", liters: 100.5 },
        { date: "2026-11-02", liters: 49.5 },
      ],
    });
    expect(rows.map((r) => [r.opening, r.in, r.out, r.closing])).toEqual([
      [1000, 0, 200, 800],
      [800, 500, 150, 1150],
      [1150, 0, 0, 1150],
    ]);
  });

  it("allows negative balance and flags it", () => {
    const rows = buildLedger({
      openingLiters: 100,
      from: "2026-11-01",
      to: "2026-11-01",
      purchases: [],
      issues: [{ date: "2026-11-01", liters: 150 }],
    });
    expect(rows[0].closing).toBe(-50);
    expect(rows[0].negative).toBe(true);
  });

  it("crosses a month end", () => {
    const rows = buildLedger({ openingLiters: 0, from: "2026-11-29", to: "2026-12-02", purchases: [], issues: [] });
    expect(rows.map((r) => r.date)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });

  it("returns nothing when from is after to", () => {
    expect(buildLedger({ openingLiters: 0, from: "2026-11-02", to: "2026-11-01", purchases: [], issues: [] })).toEqual([]);
  });
});

describe("stockDifference", () => {
  it("is measured minus book", () => {
    expect(stockDifference(1000, 980.5)).toBe(-19.5);
    expect(stockDifference(1000, 1010)).toBe(10);
  });
});
