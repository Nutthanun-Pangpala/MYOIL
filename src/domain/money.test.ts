import { describe, expect, it } from "vitest";
import { lineAmount, sumAmounts, sumLiters, hasAtMostTwoDecimals } from "./money";

describe("lineAmount", () => {
  it("multiplies liters by price", () => {
    expect(lineAmount(100, 32.5)).toBe(3250);
  });

  it("rounds to 2 decimals, half up", () => {
    expect(lineAmount(1.5, 0.01)).toBe(0.02); // 0.015 → 0.02
    expect(lineAmount(10.01, 32.33)).toBe(323.62); // 323.6233
  });

  it("is exact where plain floats are not", () => {
    // 1.005 style cases: 0.1 × 3 etc. must not drift
    expect(lineAmount(3, 0.1)).toBe(0.3);
    expect(lineAmount(0.07, 100)).toBe(7);
  });

  it("zero liters is zero baht", () => {
    expect(lineAmount(0, 32.5)).toBe(0);
  });

  it("rejects NaN / Infinity", () => {
    expect(() => lineAmount(NaN, 1)).toThrow(RangeError);
    expect(() => lineAmount(1, Infinity)).toThrow(RangeError);
  });
});

describe("sums", () => {
  it("adds baht without drift", () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
  });
  it("adds liters without drift", () => {
    expect(sumLiters([0.1, 0.2, 0.3])).toBe(0.6);
  });
  it("empty is 0", () => {
    expect(sumAmounts([])).toBe(0);
  });
});

describe("hasAtMostTwoDecimals", () => {
  it("accepts whole numbers and up to 2 decimals", () => {
    for (const n of [0, 10, 10.5, 10.55, 32.67, 1000.1]) expect(hasAtMostTwoDecimals(n)).toBe(true);
  });
  it("refuses a third decimal, however small", () => {
    for (const n of [10.555, 33.555, 0.001, 1.005]) expect(hasAtMostTwoDecimals(n)).toBe(false);
  });
  it("refuses numbers that are not finite", () => {
    expect(hasAtMostTwoDecimals(Number.NaN)).toBe(false);
  });
});
