import { describe, expect, it } from "vitest";
import { odometer, tankLevel } from "./driver-home";

describe("odometer", () => {
  it("splits whole liters into digit tiles with commas", () => {
    expect(odometer(1711)).toEqual(["1", ",", "7", "1", "1"]);
    expect(odometer(0)).toEqual(["0"]);
  });
  it("rounds to whole liters and keeps a minus sign", () => {
    expect(odometer(115.6)).toEqual(["1", "1", "6"]);
    expect(odometer(-42.2)).toEqual(["-", "4", "2"]);
  });
});

describe("tankLevel", () => {
  it("is liters over capacity, kept within 0–1", () => {
    expect(tankLevel(1500, 6000)).toBe(0.25);
    expect(tankLevel(7000, 6000)).toBe(1);
    expect(tankLevel(-5, 6000)).toBe(0);
  });
  it("shows half a tank when the size isn't set and there is fuel", () => {
    expect(tankLevel(800, null)).toBe(0.5);
    expect(tankLevel(0, null)).toBe(0);
  });
});
