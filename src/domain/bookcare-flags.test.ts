import { describe, expect, it } from "vitest";
import { flagLabel } from "./bookcare-flags";

describe("flagLabel", () => {
  it("puts the line number in front of line flags", () => {
    expect(flagLabel("new_machine:3")).toMatch(/^บรรทัด 3: /);
    expect(flagLabel("high_liters:1")).toMatch(/^บรรทัด 1: /);
  });
  it("words the plain flags", () => {
    expect(flagLabel("late")).toContain("รอบถัดไป");
    expect(flagLabel("over_balance")).toContain("ติดลบ");
  });
  it("shows an unknown code as it is", () => expect(flagLabel("something_new")).toBe("something_new"));
});
