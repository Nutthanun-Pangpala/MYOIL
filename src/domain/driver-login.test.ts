import { describe, expect, it } from "vitest";
import { MAX_TRIES, afterWrongPin, driverEmail, isPin, lockedMinutes, normalizePhone } from "./driver-login";

describe("driver login rules", () => {
  it("normalizes a phone", () => {
    expect(normalizePhone("081-234 5678")).toBe("0812345678");
    expect(normalizePhone("812345678")).toBeNull();
    expect(normalizePhone("08123456789")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(driverEmail("0812345678")).toBe("0812345678@driver.invalid");
  });
  it("a PIN is exactly 6 digits", () => {
    expect(isPin("123456")).toBe(true);
    expect(isPin("12345")).toBe(false);
    expect(isPin("12345a")).toBe(false);
  });
  it("locks on the 5th wrong PIN and starts again after the lock ran out", () => {
    const now = Date.parse("2026-11-25T03:00:00Z");
    expect(afterWrongPin(0, null, now)).toEqual({ failed: 1, lock: false, left: MAX_TRIES - 1 });
    expect(afterWrongPin(4, null, now)).toEqual({ failed: 0, lock: true, left: 0 });
    expect(afterWrongPin(3, new Date(now - 1000), now)).toEqual({ failed: 1, lock: false, left: MAX_TRIES - 1 });
    expect(lockedMinutes(new Date(now + 90_000), now)).toBe(2);
    expect(lockedMinutes(new Date(now - 1), now)).toBe(0);
    expect(lockedMinutes(null, now)).toBe(0);
  });
});
