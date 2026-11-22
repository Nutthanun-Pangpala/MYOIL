import { describe, expect, it } from "vitest";
import { checkIssue, machineKey, nextDocNo, type IssueContext, type IssueInput } from "./issue-check";

const ok: IssueInput = {
  bookNo: "0229",
  docNo: "11445",
  issueDate: "2026-11-17",
  projectId: "p1",
  timeIn: "",
  timeOut: "",
  fuelDriver: "",
  machineDriver: "",
  lines: [{ machine: "PC210", hourMeter: 115338, liters: 332 }],
  receivedSigned: true,
  receiverName: "สมชาย",
};
const clean: IssueContext = { duplicateIssueId: null, closedCycleLabel: null, history: {} };

describe("checkIssue — blocking errors", () => {
  it("a complete signed slip is fine and has no warnings", () => {
    const r = checkIssue(ok, clean);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });
  it("duplicate book+doc blocks", () => {
    const r = checkIssue(ok, { ...clean, duplicateIssueId: "x" });
    expect(r.ok).toBe(false);
    expect(r.errors.doc).toContain("มีอยู่แล้ว");
  });
  it("date in a closed cycle blocks and names the cycle", () => {
    const r = checkIssue(ok, { ...clean, closedCycleLabel: "ก.ย. 2569" });
    expect(r.ok).toBe(false);
    expect(r.errors.date).toContain("ก.ย. 2569");
  });
  it("missing project, book, doc, date block", () => {
    const r = checkIssue({ ...ok, projectId: null, bookNo: " ", docNo: "", issueDate: "" }, clean);
    expect(r.ok).toBe(false);
    expect([r.errors.project, r.errors.book, r.errors.doc, r.errors.date].every(Boolean)).toBe(true);
  });
  it("liters must be above 0, machine required, per line", () => {
    const r = checkIssue(
      { ...ok, lines: [{ machine: "A", hourMeter: null, liters: 5 }, { machine: "", hourMeter: null, liters: 0 }] },
      clean,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.lines[0]).toBeUndefined();
    expect(r.errors.lines[1]).toEqual({ machine: expect.any(String), liters: expect.any(String) });
  });
  it("needs at least one line", () => {
    expect(checkIssue({ ...ok, lines: [] }, clean).ok).toBe(false);
  });
  it("signed without a name blocks; unsigned without a name does not", () => {
    expect(checkIssue({ ...ok, receiverName: " " }, clean).errors.receiver).toBeDefined();
    expect(checkIssue({ ...ok, receivedSigned: false, receiverName: "" }, clean).ok).toBe(true);
  });
});

describe("checkIssue — warnings never block", () => {
  it("unsigned slip warns", () => {
    const r = checkIssue({ ...ok, receivedSigned: false, receiverName: "" }, clean);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.kind)).toEqual(["unsigned"]);
  });
  it("hour meter lower than last time warns", () => {
    const r = checkIssue(ok, {
      ...clean,
      history: { [machineKey("PC210")]: { lastHourMeter: { value: 115400, date: "10/11/69" }, maxLiters: null, fills: 0 } },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toMatchObject({ kind: "hours", line: 0 });
  });
  it("liters far above history warns, but only with enough history", () => {
    const big = { ...ok, lines: [{ machine: "pc210 ", hourMeter: null, liters: 2800 }] };
    const hist = (fills: number) => ({
      ...clean,
      history: { [machineKey("PC210")]: { lastHourMeter: null, maxLiters: 350, fills } },
    });
    expect(checkIssue(big, hist(5)).warnings.map((w) => w.kind)).toEqual(["liters"]);
    expect(checkIssue(big, hist(1)).warnings).toEqual([]);
  });
});

describe("machineKey / nextDocNo", () => {
  it("matches machines however typed", () => {
    expect(machineKey("  PC210 ")).toBe(machineKey("pc210"));
    expect(machineKey("รถหกล้อ   50-9653")).toBe("รถหกล้อ 50-9653");
  });
  it("increments the number and keeps leading zeros", () => {
    expect(nextDocNo("11445")).toBe("11446");
    expect(nextDocNo("0229")).toBe("0230");
    expect(nextDocNo("0999")).toBe("1000");
    expect(nextDocNo("A-009")).toBe("A-010");
    expect(nextDocNo("abc")).toBe("");
  });
});

describe("checkIssue — liters have at most 2 decimals", () => {
  it("refuses 10.555 at that line instead of rounding it", () => {
    const r = checkIssue({ ...ok, lines: [{ machine: "PC210", hourMeter: null, liters: 10.555 }] }, clean);
    expect(r.ok).toBe(false);
    expect(r.errors.lines[0].liters).toBe("ใส่ได้ไม่เกิน 2 ตำแหน่ง ตรวจกับใบอีกครั้ง");
  });
  it("accepts 10.55", () => {
    expect(checkIssue({ ...ok, lines: [{ machine: "PC210", hourMeter: null, liters: 10.55 }] }, clean).ok).toBe(true);
  });
});
