import { describe, expect, it } from "vitest";
import { parseIssueInput } from "./parse-input";

describe("parseIssueInput", () => {
  it("turns garbage into empty values instead of throwing", () => {
    const r = parseIssueInput("nope");
    expect(r.bookNo).toBe("");
    expect(r.projectId).toBeNull();
    expect(r.lines).toEqual([]);
    expect(r.receivedSigned).toBe(false);
  });
  it("drops wrong types and malformed values", () => {
    const r = parseIssueInput({
      bookNo: 5,
      issueDate: "17/11/2026",
      projectId: "'; drop table users;--",
      timeIn: "9:5",
      lines: [{ machine: "PC210", hourMeter: "12", liters: NaN }],
      receivedSigned: "true",
    });
    expect(r.bookNo).toBe("");
    expect(r.issueDate).toBe("");
    expect(r.projectId).toBeNull();
    expect(r.timeIn).toBe("");
    expect(r.lines).toEqual([{ machine: "PC210", hourMeter: null, liters: null }]);
    expect(r.receivedSigned).toBe(false);
  });
  it("caps the number of lines and keeps good values", () => {
    const lines = Array.from({ length: 50 }, () => ({ machine: "A", hourMeter: null, liters: 1 }));
    const r = parseIssueInput({
      issueDate: "2026-11-17",
      projectId: "3b241101-e2bb-4255-8caf-4136c566a962",
      timeIn: "09:10",
      lines,
      receivedSigned: true,
    });
    expect(r.lines.length).toBe(30);
    expect(r.issueDate).toBe("2026-11-17");
    expect(r.projectId).toBe("3b241101-e2bb-4255-8caf-4136c566a962");
    expect(r.timeIn).toBe("09:10");
    expect(r.receivedSigned).toBe(true);
  });
});
