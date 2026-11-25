import { describe, expect, it } from "vitest";
import { allocateFifo, partsAmount, partsPrice, stockValue, type Lot } from "./fifo";

const lot = (id: string, at: string, liters: number, price: number | null): Lot => ({ id, at, liters, price });
const line = (id: string, at: string, liters: number) => ({ id, at, liters });

describe("allocateFifo — oldest fuel first (brief §14)", () => {
  it("B3: a slip that crosses two bills is split: 600 = 100 @32.50 + 500 @33.10", () => {
    const lots = [lot("old", "2026-11-01T08:00", 1000, 32.5), lot("new", "2026-11-10T08:00", 2000, 33.1)];
    const { parts, left } = allocateFifo(lots, [line("a", "2026-11-12T09:00", 900), line("b", "2026-11-12T10:00", 600)]);
    expect(parts.get("a")).toEqual([{ kind: "bill", lotId: "old", liters: 900, price: 32.5, amount: 29250 }]);
    expect(parts.get("b")).toEqual([
      { kind: "bill", lotId: "old", liters: 100, price: 32.5, amount: 3250 },
      { kind: "bill", lotId: "new", liters: 500, price: 33.1, amount: 16550 },
    ]);
    expect(partsAmount(parts.get("b")!)).toBe(19800);
    expect(partsPrice(parts.get("b")!)).toBeNull();
    expect(stockValue(left)).toEqual({ liters: 1500, amount: 49650 });
  });

  it("B3: no new bill = the old bill's price goes on, across days and months", () => {
    const { parts } = allocateFifo([lot("a", "2026-10-01T08:00", 500, 32.5)], [line("x", "2026-10-02T09:00", 100), line("y", "2026-12-20T09:00", 100)]);
    expect(partsPrice(parts.get("x")!)).toBe(32.5);
    expect(partsPrice(parts.get("y")!)).toBe(32.5);
  });

  it("B3: a new bill while the old one still has fuel does not change the price yet", () => {
    const lots = [lot("old", "2026-11-01T08:00", 300, 32.5), lot("new", "2026-11-02T08:00", 1000, 33.1)];
    const { parts } = allocateFifo(lots, [line("x", "2026-11-03T09:00", 200)]);
    expect(parts.get("x")).toEqual([{ kind: "bill", lotId: "old", liters: 200, price: 32.5, amount: 6500 }]);
  });

  it("B8: opening stock (lot id null) is used before the first bill, at its own price", () => {
    const lots: Lot[] = [{ id: null, at: "2026-11-01T00:00", liters: 100, price: 31 }, lot("b1", "2026-11-02T08:00", 500, 33)];
    const { parts } = allocateFifo(lots, [line("x", "2026-11-05T09:00", 150)]);
    expect(parts.get("x")).toEqual([
      { kind: "opening", lotId: null, liters: 100, price: 31, amount: 3100 },
      { kind: "bill", lotId: "b1", liters: 50, price: 33, amount: 1650 },
    ]);
  });

  it("B6: liters from a bill not yet confirmed wait for a price", () => {
    const { parts } = allocateFifo([lot("pending", "2026-11-01T08:00", 500, null)], [line("x", "2026-11-02T09:00", 100)]);
    expect(parts.get("x")).toEqual([{ kind: "bill", lotId: "pending", liters: 100, price: null, amount: null }]);
    expect(partsAmount(parts.get("x")!)).toBeNull();
  });

  it("B7: more issued than bought → the part beyond the bills waits for a price, and is not taken from a later bill", () => {
    const lots = [lot("b1", "2026-11-01T08:00", 100, 32.5), lot("later", "2026-11-20T08:00", 1000, 34)];
    const { parts, left } = allocateFifo(lots, [line("x", "2026-11-05T09:00", 150), line("y", "2026-11-21T09:00", 10)]);
    expect(parts.get("x")!.map((p) => [p.liters, p.price])).toEqual([
      [100, 32.5],
      [50, null],
    ]);
    expect(parts.get("y")).toEqual([{ kind: "bill", lotId: "later", liters: 10, price: 34, amount: 340 }]);
    expect(left[0].liters).toBe(990);
  });

  it("B4: order is by date and time, not by the order things were typed in; a bill at the same minute comes first", () => {
    const lots = [lot("pm", "2026-11-25T13:00", 500, 32.8), lot("am", "2026-11-25T08:00", 100, 32.5)];
    const { parts } = allocateFifo(lots, [line("early", "2026-11-25T09:30", 100), line("same", "2026-11-25T13:00", 50)]);
    expect(partsPrice(parts.get("early")!)).toBe(32.5);
    expect(partsPrice(parts.get("same")!)).toBe(32.8);
  });

  it("B5: a slip of a closed cycle keeps what it was billed and still uses up its bill", () => {
    const lots = [lot("b1", "2026-10-01T08:00", 300, 30), lot("b2", "2026-11-01T08:00", 500, 35)];
    const frozen = [{ kind: "bill" as const, lotId: "b1", liters: 200, price: 29, amount: 5800 }]; // billed at the bill's old price
    const { parts } = allocateFifo(lots, [{ id: "closed", at: "2026-10-05T09:00", liters: 200, frozen }, line("open", "2026-11-05T09:00", 150)]);
    expect(parts.get("closed")).toBe(frozen);
    expect(parts.get("open")!.map((p) => [p.lotId, p.liters, p.price])).toEqual([
      ["b1", 100, 30],
      ["b2", 50, 35],
    ]);
  });
});
