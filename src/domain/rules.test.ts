import { describe, expect, it } from "vitest";
import { countsInBalance, countsInInvoice, countsInMonthly, receiverNameError } from "./rules";

const signed = { cancelled: false, receivedSigned: true };
const unsigned = { cancelled: false, receivedSigned: false };
const cancelled = { cancelled: true, receivedSigned: true };

describe("what counts where", () => {
  it("signed issue counts everywhere", () => {
    expect([countsInBalance(signed), countsInMonthly(signed), countsInInvoice(signed)]).toEqual([true, true, true]);
  });
  it("unsigned issue counts in balance and monthly, not in the invoice", () => {
    expect([countsInBalance(unsigned), countsInMonthly(unsigned), countsInInvoice(unsigned)]).toEqual([
      true,
      true,
      false,
    ]);
  });
  it("cancelled issue counts nowhere", () => {
    expect([countsInBalance(cancelled), countsInMonthly(cancelled), countsInInvoice(cancelled)]).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe("receiverNameError", () => {
  it("needs a name only when signed", () => {
    expect(receiverNameError(true, "")).not.toBeNull();
    expect(receiverNameError(true, "   ")).not.toBeNull();
    expect(receiverNameError(true, "สมชาย")).toBeNull();
    expect(receiverNameError(false, "")).toBeNull();
    expect(receiverNameError(false, undefined)).toBeNull();
  });
});
