import { describe, expect, it } from "vitest";
import { priceOn } from "./price";

const prices = [
  { date: "2026-11-03", pricePerLiter: 32.1 },
  { date: "2026-11-01", pricePerLiter: 31.5 },
  { date: "2026-11-10", pricePerLiter: 33 },
];

describe("priceOn", () => {
  it("uses the price of that exact date", () => {
    expect(priceOn(prices, "2026-11-03")).toBe(32.1);
  });
  it("falls back to the latest earlier price (input order does not matter)", () => {
    expect(priceOn(prices, "2026-11-09")).toBe(32.1);
    expect(priceOn(prices, "2026-12-31")).toBe(33);
  });
  it("returns null when nothing is on or before the date", () => {
    expect(priceOn(prices, "2026-10-31")).toBeNull();
    expect(priceOn([], "2026-11-01")).toBeNull();
  });
});
