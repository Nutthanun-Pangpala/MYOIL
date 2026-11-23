import { describe, expect, it } from "vitest";
import { purchaseFlags, appBookNo, appDocNo, checkIssueRequest, checkPurchaseRequest, checkSignatureRequest, parseDecimal } from "./bookcare-api";

const SHA = "a".repeat(64);
const img = { mime: "image/jpeg", sha256: SHA, takenAt: "2026-11-23T10:08:12+07:00", data: "/9j/4AAQ" };
const REF = "3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69";
const issue = () => ({
  ref: REF,
  projectRefCode: "PCOB",
  issueDate: "2026-11-23",
  timeIn: "10:05",
  timeOut: "10:21",
  recordedAt: "2026-11-23T10:05:00+07:00",
  driver: { bookcareUserId: "u1", name: "สมชาย" },
  vehicleCode: "OIL-1",
  lines: [{ position: 1, machineId: null, machineCode: "PC210", liters: "120", hourMeter: "1532.5", photo: { ...img } }],
  signature: { receiverName: "สมศรี", signedAt: "2026-11-23T10:21:30+07:00", image: { ...img } },
  unsignedReason: null,
  confirmedWarnings: ["high_liters:1"],
});

describe("parseDecimal", () => {
  it("takes text numbers with up to 2 decimals", () => {
    expect(parseDecimal("120")).toBe(120);
    expect(parseDecimal("120.5")).toBe(120.5);
    expect(parseDecimal("0.25")).toBe(0.25);
  });
  it("refuses 3 decimals, numbers as numbers, negatives, junk", () => {
    expect(parseDecimal("1.005")).toBeNull();
    expect(parseDecimal(120)).toBeNull();
    expect(parseDecimal("-1")).toBeNull();
    expect(parseDecimal("1e3")).toBeNull();
    expect(parseDecimal("")).toBeNull();
  });
});

describe("checkIssueRequest", () => {
  it("accepts a signed slip", () => {
    const r = checkIssueRequest(issue());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lines[0]).toMatchObject({ liters: 120, hourMeter: 1532.5, machineId: null });
    if (r.ok) expect(r.value).toMatchObject({ timeIn: "10:05", timeOut: "10:21" });
  });
  it("takes timeIn / timeOut as optional HH:MM, refuses anything else", () => {
    const r = checkIssueRequest({ ...issue(), timeIn: undefined, timeOut: "" });
    expect(r.ok && [r.value.timeIn, r.value.timeOut]).toEqual([null, null]);
    expect(checkIssueRequest({ ...issue(), timeIn: "25:00" })).toMatchObject({ ok: false, field: "timeIn" });
    expect(checkIssueRequest({ ...issue(), timeOut: "10:5" })).toMatchObject({ ok: false, field: "timeOut" });
    expect(checkIssueRequest({ ...issue(), timeIn: 1005 })).toMatchObject({ ok: false, field: "timeIn" });
  });
  it("accepts an unsigned slip with a reason", () => {
    const b = { ...issue(), signature: null, unsignedReason: "ผู้รับไม่อยู่" };
    const r = checkIssueRequest(b);
    expect(r.ok && r.value.signature).toBeNull();
  });
  it("needs exactly one of signature / reason", () => {
    expect(checkIssueRequest({ ...issue(), unsignedReason: "x" })).toMatchObject({ ok: false, field: "signature" });
    expect(checkIssueRequest({ ...issue(), signature: null })).toMatchObject({ ok: false, field: "signature" });
  });
  it("a signature always carries the receiver's name (R6)", () => {
    const b = issue();
    b.signature.receiverName = " ";
    expect(checkIssueRequest(b)).toMatchObject({ ok: false, field: "signature.receiverName" });
  });
  it("refuses 3 decimals in liters and says which line", () => {
    const b = issue();
    b.lines[0].liters = "10.005";
    expect(checkIssueRequest(b)).toMatchObject({ ok: false, field: "lines[0].liters" });
  });
  it("every line needs its meter photo (R1)", () => {
    const b = issue() as any;
    delete b.lines[0].photo;
    expect(checkIssueRequest(b)).toMatchObject({ ok: false, field: "lines[0].photo" });
  });
  it("1–10 lines, no repeated position", () => {
    const b = issue();
    expect(checkIssueRequest({ ...b, lines: [] })).toMatchObject({ ok: false, field: "lines" });
    expect(checkIssueRequest({ ...b, lines: [b.lines[0], b.lines[0]] })).toMatchObject({ ok: false, field: "lines[1].position" });
  });
  it("refuses a bad ref, date, image type and warning code", () => {
    expect(checkIssueRequest({ ...issue(), ref: "x" })).toMatchObject({ ok: false, field: "ref" });
    expect(checkIssueRequest({ ...issue(), issueDate: "2026-02-30" })).toMatchObject({ ok: false, field: "issueDate" });
    const b = issue();
    (b.lines[0].photo as any).mime = "image/png";
    expect(checkIssueRequest(b)).toMatchObject({ ok: false, field: "lines[0].photo.mime" });
    expect(checkIssueRequest({ ...issue(), confirmedWarnings: ["drop table"] })).toMatchObject({ ok: false, field: "confirmedWarnings" });
  });
});

describe("checkPurchaseRequest", () => {
  const p = () => ({ ref: REF, purchaseDate: "2026-11-23", recordedAt: null, driver: { bookcareUserId: "u1", name: "ก" }, liters: "2000", amount: "64980.00", billNo: "INV-1", billPhoto: { ...img } });
  it("accepts", () => expect(checkPurchaseRequest(p())).toMatchObject({ ok: true, value: { liters: 2000, amount: 64980 } }));
  it("needs the bill photo and a positive amount", () => {
    expect(checkPurchaseRequest({ ...p(), billPhoto: undefined })).toMatchObject({ ok: false, field: "billPhoto" });
    expect(checkPurchaseRequest({ ...p(), amount: "0" })).toMatchObject({ ok: false, field: "amount" });
  });
});

describe("checkSignatureRequest", () => {
  it("accepts and needs the name", () => {
    const s = { signatureRef: REF, receiverName: "ก", signedAt: "2026-11-24T08:15:00+07:00", image: { ...img } };
    expect(checkSignatureRequest(s).ok).toBe(true);
    expect(checkSignatureRequest({ ...s, receiverName: "" })).toMatchObject({ ok: false, field: "receiverName" });
  });
});

describe("phone slip numbers", () => {
  it("book = M + Buddhist year (2 digits) + month of the slip's date", () => {
    expect(appBookNo("2026-11-23")).toBe("M6911");
    expect(appBookNo("2026-01-05")).toBe("M6901");
    expect(appBookNo("2027-12-31")).toBe("M7012");
  });
  it("doc no. is 4 digits and never wraps", () => {
    expect(appDocNo(1)).toBe("0001");
    expect(appDocNo(237)).toBe("0237");
    expect(appDocNo(10000)).toBe("10000");
  });
});

describe("purchaseFlags", () => {
  it("is quiet for an ordinary purchase", () => expect(purchaseFlags({ liters: 2000, price: 32.5, dailyPrice: 32, capacity: 6000 })).toEqual([]));
  it("names each oddity", () => {
    expect(purchaseFlags({ liters: 2000, price: 45, dailyPrice: 32, capacity: 6000 })).toEqual(["price_far_from_daily"]);
    expect(purchaseFlags({ liters: 7000, price: 32, dailyPrice: null, capacity: 6000 })).toEqual(["over_capacity"]);
    expect(purchaseFlags({ liters: 50, price: 32, dailyPrice: 32, capacity: null })).toEqual(["small_purchase"]);
  });
});
