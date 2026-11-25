import { describe, expect, it } from "vitest";
import { calendarMonthCycle, cycleContaining, cycleRanges, isCutDay, nextCycleAfter, overlaps } from "./cycle";

describe("calendarMonthCycle", () => {
  it("covers the whole month", () => {
    expect(calendarMonthCycle("2026-11-22")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(calendarMonthCycle("2026-12-01")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
  it("knows February (leap and not)", () => {
    expect(calendarMonthCycle("2027-02-10").end).toBe("2027-02-28");
    expect(calendarMonthCycle("2028-02-10").end).toBe("2028-02-29");
  });
});

describe("nextCycleAfter", () => {
  it("starts the day after and runs to that month's end", () => {
    expect(nextCycleAfter("2026-11-30")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(nextCycleAfter("2026-12-31")).toEqual({ start: "2027-01-01", end: "2027-01-31" });
  });
});

describe("a cut day: the cycle is cut on the 21st of every month", () => {
  it("a date up to the 21st belongs to the cycle ending that 21st, later dates to the next one", () => {
    expect(cycleContaining("2026-11-05", 21)).toEqual({ start: "2026-10-22", end: "2026-11-21" });
    expect(cycleContaining("2026-11-21", 21)).toEqual({ start: "2026-10-22", end: "2026-11-21" });
    expect(cycleContaining("2026-11-22", 21)).toEqual({ start: "2026-11-22", end: "2026-12-21" });
  });
  it("rolls over the year both ways", () => {
    expect(cycleContaining("2026-12-25", 21)).toEqual({ start: "2026-12-22", end: "2027-01-21" });
    expect(cycleContaining("2027-01-10", 21)).toEqual({ start: "2026-12-22", end: "2027-01-21" });
  });
  it("no cut day = the calendar month", () => {
    expect(cycleContaining("2026-11-22", null)).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });
  it("the next cycle starts the day after, whatever the last end was, and runs to the next cut", () => {
    expect(nextCycleAfter("2026-11-21", 21)).toEqual({ start: "2026-11-22", end: "2026-12-21" });
    expect(nextCycleAfter("2026-11-30", 21)).toEqual({ start: "2026-12-01", end: "2026-12-21" });
  });
  it("lays cycles in a row from an anchor until a day is covered", () => {
    expect(cycleRanges("2026-11-01", 21, 2, "2026-11-25")).toEqual([
      { start: "2026-11-01", end: "2026-11-21" },
      { start: "2026-11-22", end: "2026-12-21" },
    ]);
    expect(cycleRanges("2026-11-01", null, 1, "2026-11-25")).toEqual([{ start: "2026-11-01", end: "2026-11-30" }]);
  });
  it("accepts 1–28 only", () => {
    expect([1, 21, 28].every(isCutDay)).toBe(true);
    expect([0, 29, 31, 2.5, "21", null].some(isCutDay)).toBe(false);
  });
});

describe("overlaps", () => {
  it("detects overlap and touching ends", () => {
    const nov = { start: "2026-11-01", end: "2026-11-30" };
    expect(overlaps(nov, { start: "2026-11-30", end: "2026-12-05" })).toBe(true);
    expect(overlaps(nov, { start: "2026-12-01", end: "2026-12-31" })).toBe(false);
  });
});

import { INVOICE_FLOW, nextInvoiceStatus, planClose, reopenReasonError } from "./cycle";

describe("planClose — what happens to the slips when a cycle closes", () => {
  const s = (id: string, signed: boolean, liters: number, cancelled = false) => ({ id, signed, cancelled, liters });
  it("signed slips stay for the invoice, unsigned ones are carried to the next cycle", () => {
    const p = planClose([s("a", true, 100), s("b", false, 40.5), s("c", false, 10), s("d", true, 5)]);
    expect(p.invoiceSlips).toBe(2);
    expect(p.carryIds).toEqual(["b", "c"]);
    expect(p.carryLiters).toBe(50.5);
  });
  it("cancelled slips are never carried and never counted", () => {
    const p = planClose([s("a", false, 40, true), s("b", true, 10, true)]);
    expect(p).toEqual({ invoiceSlips: 0, carryIds: [], carryLiters: 0 });
  });
  it("adds liters without float drift", () => {
    expect(planClose([s("a", false, 0.1), s("b", false, 0.2)]).carryLiters).toBe(0.3);
  });
});

describe("invoice status flow", () => {
  it("goes forward one step at a time and stops at the end", () => {
    expect(INVOICE_FLOW).toEqual(["draft", "sent_to_pm", "pm_signed", "sent_to_accounting"]);
    expect(nextInvoiceStatus("draft")).toBe("sent_to_pm");
    expect(nextInvoiceStatus("pm_signed")).toBe("sent_to_accounting");
    expect(nextInvoiceStatus("sent_to_accounting")).toBeNull();
  });
});

describe("reopenReasonError", () => {
  it("needs a reason", () => {
    expect(reopenReasonError("  ")).not.toBeNull();
    expect(reopenReasonError("พบใบตกหล่น")).toBeNull();
  });
});
