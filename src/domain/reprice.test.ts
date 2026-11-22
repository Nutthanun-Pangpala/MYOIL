import { describe, expect, it } from "vitest";
import { repricePending } from "./reprice";

const prices = [
  { date: "2026-11-01", pricePerLiter: 43.64 },
  { date: "2026-11-12", pricePerLiter: 44.14 },
];

describe("repricePending", () => {
  it("prices a waiting line from the latest price on or before its date", () => {
    const r = repricePending([{ id: "a", issueDate: "2026-11-15", liters: 100 }], prices);
    expect(r).toEqual([{ id: "a", pricePerLiter: 44.14, amount: 4414 }]);
  });
  it("leaves a line with still no price out of the result", () => {
    expect(repricePending([{ id: "a", issueDate: "2026-10-30", liters: 100 }], prices)).toEqual([]);
  });
  it("handles several lines on different days", () => {
    const r = repricePending(
      [
        { id: "a", issueDate: "2026-11-05", liters: 10 },
        { id: "b", issueDate: "2026-11-12", liters: 10 },
      ],
      prices,
    );
    expect(r.map((x) => [x.id, x.pricePerLiter, x.amount])).toEqual([
      ["a", 43.64, 436.4],
      ["b", 44.14, 441.4],
    ]);
  });
});

import { repriceOpen } from "./reprice";

describe("repriceOpen — a corrected price reaches the lines already priced", () => {
  const line = (id: string, issueDate: string, current: number | null) => ({ id, issueDate, liters: 10, currentPrice: current });
  it("changes a line whose price is no longer the price of its date", () => {
    const r = repriceOpen([line("a", "2026-11-15", 40)], prices);
    expect(r).toEqual([{ id: "a", pricePerLiter: 44.14, amount: 441.4, wasWaiting: false }]);
  });
  it("leaves a line that already has the right price alone", () => {
    expect(repriceOpen([line("a", "2026-11-15", 44.14)], prices)).toEqual([]);
  });
  it("marks a waiting line as such", () => {
    expect(repriceOpen([line("a", "2026-11-05", null)], prices)[0].wasWaiting).toBe(true);
  });
  it("still-no-price lines stay out", () => {
    expect(repriceOpen([line("a", "2026-10-01", null)], prices)).toEqual([]);
  });
});
