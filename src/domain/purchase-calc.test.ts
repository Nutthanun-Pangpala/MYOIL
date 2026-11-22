import { describe, expect, it } from "vitest";
import { completePurchase, purchaseOddities } from "./purchase-calc";

describe("completePurchase", () => {
  it("fills the amount from liters and price", () => {
    expect(completePurchase({ liters: 1900, price: 29.99, amount: null })).toEqual({
      ok: true,
      liters: 1900,
      price: 29.99,
      amount: 56981,
    });
  });
  it("fills the price from liters and amount", () => {
    expect(completePurchase({ liters: 1200, price: null, amount: 52368 })).toEqual({
      ok: true,
      liters: 1200,
      price: 43.64,
      amount: 52368,
    });
  });
  it("fills the liters from price and amount", () => {
    expect(completePurchase({ liters: null, price: 44.44, amount: 119988 })).toEqual({
      ok: true,
      liters: 2700,
      price: 44.44,
      amount: 119988,
    });
  });
  it("accepts all three when they agree (within a satang), refuses when they do not", () => {
    expect(completePurchase({ liters: 2700, price: 44.44, amount: 119988 }).ok).toBe(true);
    expect(completePurchase({ liters: 2700, price: 44.44, amount: 119988.01 }).ok).toBe(true);
    const bad = completePurchase({ liters: 2700, price: 44.44, amount: 120000 });
    expect(bad.ok).toBe(false);
  });
  it("needs two fields, all above zero", () => {
    expect(completePurchase({ liters: 100, price: null, amount: null }).ok).toBe(false);
    expect(completePurchase({ liters: null, price: null, amount: null }).ok).toBe(false);
    expect(completePurchase({ liters: 0, price: 10, amount: null }).ok).toBe(false);
    expect(completePurchase({ liters: -5, price: 10, amount: null }).ok).toBe(false);
  });
});

describe("completePurchase: at most 2 decimals", () => {
  it("refuses liters with a third decimal, naming the field", () => {
    expect(completePurchase({ liters: 10.555, price: 32.5, amount: null })).toEqual({ ok: false, error: "ใส่ได้ไม่เกิน 2 ตำแหน่ง ตรวจกับใบอีกครั้ง", field: "liters" });
  });
  it("refuses a price with a third decimal", () => {
    const r = completePurchase({ liters: 100, price: 33.555, amount: null });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.field).toBe("price");
  });
  it("still derives a price that needs rounding from liters and amount", () => {
    expect(completePurchase({ liters: 3000, price: null, amount: 98000 })).toEqual({ ok: true, liters: 3000, price: 32.67, amount: 98000 });
  });
});

describe("purchaseOddities (OBS-17)", () => {
  const ok = { liters: 5000, price: 33, dailyPrice: 32.5, capacity: 10000 };
  it("is quiet for an ordinary purchase", () => {
    expect(purchaseOddities(ok)).toEqual([]);
  });
  it("asks when the price is more than 20% from the latest daily price", () => {
    expect(purchaseOddities({ ...ok, price: 100 })).toHaveLength(1);
    expect(purchaseOddities({ ...ok, price: 39 })).toEqual([]); // exactly 20% is fine
    expect(purchaseOddities({ ...ok, price: 39.01 })).toHaveLength(1);
  });
  it("asks when more than the tank holds, but only once a capacity is set", () => {
    expect(purchaseOddities({ ...ok, liters: 10001 })).toHaveLength(1);
    expect(purchaseOddities({ ...ok, liters: 10001, capacity: null })).toEqual([]);
  });
  it("asks for under 100 liters, and says every reason at once", () => {
    expect(purchaseOddities({ ...ok, liters: 0.3 })).toHaveLength(1);
    expect(purchaseOddities({ liters: 0.3, price: 100, dailyPrice: 32.5, capacity: null })).toHaveLength(2);
  });
  it("has no price rule before any daily price exists", () => {
    expect(purchaseOddities({ ...ok, dailyPrice: null, price: 100 })).toEqual([]);
  });
});
