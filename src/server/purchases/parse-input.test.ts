import { describe, expect, it } from "vitest";
import { parsePriceInput, parsePurchaseInput } from "./parse-input";

describe("parsePurchaseInput", () => {
  it("turns garbage into empty values instead of throwing", () => {
    expect(parsePurchaseInput(null)).toEqual({
      date: "",
      time: "",
      liters: null,
      price: null,
      amount: null,
      billNo: "",
      billPhoto: null,
      confirmed: false,
      note: "",
      reason: "",
    });
  });
  it("keeps good values and drops wrong types, impossible dates, NaN", () => {
    const r = parsePurchaseInput({ date: "2026-02-30", liters: "100", price: NaN, amount: 5, billNo: 7, note: "x" });
    expect(r.date).toBe("");
    expect(r.liters).toBeNull();
    expect(r.price).toBeNull();
    expect(r.amount).toBe(5);
    expect(r.billNo).toBe("");
    expect(r.note).toBe("x");
  });
  it("keeps a real time of day on the bill and drops anything else (brief §14 B9)", () => {
    expect(parsePurchaseInput({ time: "09:30" }).time).toBe("09:30");
    expect(parsePurchaseInput({ time: "23:59" }).time).toBe("23:59");
    for (const bad of ["24:00", "9:30", "09:60", "0930", 930, null]) expect(parsePurchaseInput({ time: bad }).time).toBe("");
  });
  it("accepts a real date and caps text", () => {
    const r = parsePurchaseInput({ date: "2026-11-17", billNo: "B".repeat(500), note: "n".repeat(900) });
    expect(r.date).toBe("2026-11-17");
    expect(r.billNo).toHaveLength(50);
    expect(r.note).toHaveLength(300);
  });
});

describe("parsePriceInput", () => {
  it("reads date and price, nothing else", () => {
    expect(parsePriceInput({ date: "2026-11-19", price: 44.44, junk: 1 })).toEqual({ date: "2026-11-19", price: 44.44 });
    expect(parsePriceInput("x")).toEqual({ date: "", price: null });
  });
});
