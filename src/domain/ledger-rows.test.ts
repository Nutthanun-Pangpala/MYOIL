import { describe, expect, it } from "vitest";
import { ledgerRows, ledgerSummary } from "./ledger-rows";

const base = {
  openingLiters: 380,
  from: "2026-11-01",
  to: "2026-11-03",
  purchases: [{ date: "2026-11-01", liters: 1200, amount: 52368 }],
  issues: [
    { date: "2026-11-01", liters: 743 },
    { date: "2026-11-02", liters: 849 },
    { date: "2026-11-03", liters: 100 },
  ],
  prices: [{ date: "2026-11-01", pricePerLiter: 43.64 }],
  checks: [] as { date: string; liters: number }[],
};

describe("ledgerRows", () => {
  it("runs the book day by day with the day's price on every row", () => {
    const r = ledgerRows(base);
    expect(r.map((x) => [x.date, x.in, x.out, x.closing, x.price])).toEqual([
      ["2026-11-01", 1200, 743, 837, 43.64],
      ["2026-11-02", 0, 849, -12, 43.64],
      ["2026-11-03", 0, 100, -112, 43.64],
    ]);
  });
  it("shows the money bought only on days with a purchase", () => {
    const r = ledgerRows(base);
    expect(r[0].purchaseAmount).toBe(52368);
    expect(r[1].purchaseAmount).toBeNull();
  });
  it("flags a negative balance", () => {
    expect(ledgerRows(base).map((x) => x.negative)).toEqual([false, true, true]);
  });
  it("compares a measured amount with the book: measured − book", () => {
    const r = ledgerRows({ ...base, checks: [{ date: "2026-11-01", liters: 837 }, { date: "2026-11-02", liters: -20 }] });
    expect(r[0].measured).toBe(837);
    expect(r[0].diff).toBe(0);
    expect(r[1].diff).toBe(-8);
    expect(r[2].measured).toBeNull();
    expect(r[2].diff).toBeNull();
  });
  it("a day before any price has none", () => {
    const r = ledgerRows({ ...base, prices: [{ date: "2026-11-02", pricePerLiter: 44 }] });
    expect(r.map((x) => x.price)).toEqual([null, 44, 44]);
  });
});

describe("ledgerSummary", () => {
  it("opening of the first row, totals, closing of the last row", () => {
    const s = ledgerSummary(ledgerRows(base));
    expect(s).toEqual({ opening: 380, in: 1200, out: 1692, closing: -112, amount: 52368 });
  });
  it("empty month", () => {
    expect(ledgerSummary([])).toEqual({ opening: 0, in: 0, out: 0, closing: 0, amount: 0 });
  });
});
