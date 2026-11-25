import { describe, expect, it } from "vitest";
import { formatStamp } from "./format";

describe("formatStamp", () => {
  it("writes a moment the way the screens do: Bangkok day in BE and the time", () => {
    expect(formatStamp(new Date("2026-11-22T02:15:00Z"))).toBe("22/11/69 09:15");
  });

  it("uses the Bangkok day, not the server's", () => {
    // 17:30 UTC on the 30th is already 00:30 on 1 December in Bangkok
    expect(formatStamp(new Date("2026-11-30T17:30:00Z"))).toBe("01/12/69 00:30");
  });
});
