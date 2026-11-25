import { describe, expect, it } from "vitest";
import { checkIssueRequest } from "./bookcare-api";
import { bangkok, isHighLiters, issueBody, litersValue, machineArt, totalLiters, typeLiters, type Draft } from "./driver-fill";

const type = (keys: string) => [...keys].reduce((t, k) => typeLiters(t, k === "<" ? "back" : k), "");

describe("typeLiters", () => {
  it("builds a number digit by digit, one point, two decimals at most", () => {
    expect(type("85")).toBe("85");
    expect(type("120.5")).toBe("120.5");
    expect(type("1.2.345")).toBe("1.23");
  });
  it("drops a leading zero, starts a bare point with 0, stops at 5 digits", () => {
    expect(type("05")).toBe("5");
    expect(type(".5")).toBe("0.5");
    expect(type("1234567")).toBe("12345");
  });
  it("back removes the last key", () => {
    expect(type("85<")).toBe("8");
    expect(type("<")).toBe("");
  });
});

describe("litersValue", () => {
  it("is null until there is a number above zero", () => {
    expect(litersValue("")).toBeNull();
    expect(litersValue("0")).toBeNull();
    expect(litersValue("0.")).toBeNull();
    expect(litersValue("85")).toBe(85);
    expect(litersValue("12.")).toBe(12);
  });
});

describe("isHighLiters", () => {
  it("asks only when well above what the machine usually takes", () => {
    expect(isHighLiters(850, 150)).toBe(true);
    expect(isHighLiters(200, 150)).toBe(false);
    expect(isHighLiters(850, null)).toBe(false);
  });
});

describe("bangkok", () => {
  it("writes the Bangkok date and clock of an instant", () => {
    expect(bangkok(new Date("2026-11-24T18:30:05Z"))).toEqual({ date: "2026-11-25", time: "01:30", stamp: "2026-11-25T01:30:05+07:00" });
  });
});

const shot = { data: "AAAA", sha256: "a".repeat(64), takenAt: "2026-11-25T10:08:00+07:00" };
const draft: Draft = {
  stopId: "11111111-1111-4111-8111-111111111111",
  ref: "22222222-2222-4222-8222-222222222222",
  projectRefCode: "PCOB",
  date: "2026-11-25",
  startedAt: "2026-11-25T03:05:00Z",
  lines: [
    { id: "a", machineId: "33333333-3333-4333-8333-333333333333", machineCode: "PC210", liters: "120", hourMeter: "", photo: shot, confirmedHigh: false },
    { id: "b", machineId: null, machineCode: " รถหกล้อ 50-9653 ", liters: "85.", hourMeter: "1200.5", photo: shot, confirmedHigh: true },
    { id: "c", machineId: "33333333-3333-4333-8333-333333333333", machineCode: "PC210", liters: "10", hourMeter: "", photo: shot, confirmedHigh: false },
  ],
};

describe("issueBody", () => {
  const now = new Date("2026-11-25T03:21:00Z");
  it("is a request the server's own check accepts, with site times and warnings the driver confirmed", () => {
    const body = issueBody(draft, { receiverName: " สมชาย ", image: shot }, now);
    expect(body.timeIn).toBe("10:05");
    expect(body.timeOut).toBe("10:21");
    expect(body.lines.map((l) => l.liters)).toEqual(["120", "85", "10"]);
    expect(body.lines[1].hourMeter).toBe("1200.5");
    expect(body.confirmedWarnings).toEqual(["high_liters:2", "duplicate_machine:3"]);
    const checked = checkIssueRequest({ ...body, driver: { bookcareUserId: "u", name: "คนขับ" } });
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.value.signature?.receiverName).toBe("สมชาย");
  });
  it("sends the reason instead of a signature when nobody signs", () => {
    const body = issueBody(draft, { unsignedReason: "ไม่มีสโตร์หรือโฟร์แมนอยู่ที่หน้างาน" }, now);
    expect(body.signature).toBeNull();
    expect(checkIssueRequest({ ...body, driver: { bookcareUserId: "u", name: "คนขับ" } }).ok).toBe(true);
  });
  it("totals the liters of the slip", () => {
    expect(totalLiters(draft.lines)).toBe(215);
  });
});

describe("machineArt", () => {
  it("picks the picture from the code, or from the admin's type", () => {
    expect(machineArt("PC210")).toBe("excavator");
    expect(machineArt("FL022")).toBe("forklift");
    expect(machineArt("รถหกล้อ 50-9653")).toBe("truck");
    expect(machineArt("82-4471")).toBe("truck");
    expect(machineArt("X-77", "รถ")).toBe("truck");
    expect(machineArt("X-77")).toBe("excavator");
  });
});
