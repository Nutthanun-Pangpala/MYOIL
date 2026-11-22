import { describe, expect, it } from "vitest";
import { pricePeriods } from "./price-periods";

describe("pricePeriods", () => {
  it("runs each price until the day before the next, newest first", () => {
    const r = pricePeriods([
      { date: "2026-11-12", pricePerLiter: 44.14, source: "purchase" },
      { date: "2026-11-01", pricePerLiter: 43.64, source: "purchase" },
      { date: "2026-11-19", pricePerLiter: 44.44, source: "manual" },
    ]);
    expect(r.map((p) => [p.from, p.to, p.pricePerLiter])).toEqual([
      ["2026-11-19", null, 44.44],
      ["2026-11-12", "2026-11-18", 44.14],
      ["2026-11-01", "2026-11-11", 43.64],
    ]);
  });
  it("empty in, empty out", () => {
    expect(pricePeriods([])).toEqual([]);
  });
});
