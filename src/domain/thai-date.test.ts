import { describe, expect, it } from "vitest";
import { thaiLong, thaiMonth, thaiMonthShort, thaiRange, thaiShort } from "./thai-date";

describe("thai dates", () => {
  it("table form", () => {
    expect(thaiShort("2026-11-17")).toBe("17/11/69");
    expect(thaiShort("2026-01-05")).toBe("05/01/69");
  });
  it("balance-book form", () => {
    expect(thaiLong("2026-03-01")).toBe("1 มี.ค. 69");
  });
  it("month headings", () => {
    expect(thaiMonth("2026-09-15")).toBe("กันยายน 2569");
    expect(thaiMonthShort("2026-09-15")).toBe("ก.ย. 2569");
  });
  it("rejects a non-ISO date", () => {
    expect(() => thaiShort("17/11/2026")).toThrow(RangeError);
  });
});

describe("thaiRange", () => {
  it("one month: days, then the month once", () => expect(thaiRange("2026-11-01", "2026-11-30")).toBe("1–30 พ.ย. 2569"));
  it("two months of one year", () => expect(thaiRange("2026-10-28", "2026-11-03")).toBe("28 ต.ค.–3 พ.ย. 2569"));
  it("across new year", () => expect(thaiRange("2026-12-28", "2027-01-03")).toBe("28 ธ.ค. 2569–3 ม.ค. 2570"));
});
