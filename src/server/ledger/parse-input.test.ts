import { describe, expect, it } from "vitest";
import { parseStockCheckInput } from "./parse-input";

describe("parseStockCheckInput", () => {
  it("reads a date and liters", () => {
    expect(parseStockCheckInput({ date: "2026-11-14", liters: 1566 })).toEqual({ date: "2026-11-14", liters: 1566 });
  });
  it("empty / missing liters means 'clear the measurement'", () => {
    expect(parseStockCheckInput({ date: "2026-11-14", liters: null })).toEqual({ date: "2026-11-14", liters: null });
    expect(parseStockCheckInput({ date: "2026-11-14" })).toEqual({ date: "2026-11-14", liters: null });
  });
  it("rejects a bad date and negative or non-finite liters", () => {
    expect(parseStockCheckInput({ date: "2026-02-31", liters: 5 }).date).toBe("");
    expect(parseStockCheckInput({ date: "2026-11-14", liters: -3 }).liters).toBeNull();
    expect(parseStockCheckInput({ date: "2026-11-14", liters: Infinity }).liters).toBeNull();
    expect(parseStockCheckInput("x")).toEqual({ date: "", liters: null });
  });
});
