import { describe, expect, it } from "vitest";
import { navFor } from "./nav";

describe("navFor", () => {
  it("executive does not see purchases or settings", () => {
    const labels = navFor("executive").map((n) => n.label);
    expect(labels.includes("ซื้อน้ำมันเข้า")).toBe(false);
    expect(labels.includes("ตั้งค่า")).toBe(false);
    expect(labels.includes("สมุดคงเหลือ")).toBe(true);
  });
  it("project_viewer does not see the balance book", () => {
    expect(navFor("project_viewer").map((n) => n.label).includes("สมุดคงเหลือ")).toBe(false);
  });
  it("system_admin sees everything", () => {
    expect(navFor("system_admin").length).toBe(7);
  });
});
