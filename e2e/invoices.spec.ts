import { expect, test, type Page } from "@playwright/test";
import { keyIssue, login, resetData } from "./helpers";

const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

test.describe.configure({ mode: "serial" });
test.beforeAll(resetData);

async function signCurrentSlip(page: Page, name: string) {
  await page.getByRole("button", { name: "ติ๊กว่าเซ็นรับแล้ว" }).click();
  await page.getByLabel("ชื่อผู้เซ็นรับ").fill(name);
  await page.getByRole("button", { name: "บันทึกว่าเซ็นรับแล้ว" }).click();
  await expect(page.getByText("ผู้เซ็นรับ: - → " + name)).toBeVisible();
}

/** design 6.9: the cycle is picked in the "รอบเคลม" box of the header; choosing one opens it at once */
async function openThisCycle(page: Page) {
  await page.goto("/invoices");
  const pick = page.getByLabel("รอบเคลม");
  const value = await pick.locator("option", { hasText: "(รอบนี้)" }).getAttribute("value");
  await pick.selectOption(value!);
  await expect(page).toHaveURL(new RegExp(`[?&]cycle=${value}`));
  await expect(pick).toHaveValue(value!);
}

test("signed slips make the invoice, unsigned ones wait and are said before closing", async ({ page }) => {
  await login(page, "store");
  await keyIssue(page, { book: "9", doc: "1", date: TODAY, machine: "PC210", liters: "100" });
  await signCurrentSlip(page, "สมชาย");
  await keyIssue(page, { book: "9", doc: "2", date: TODAY, machine: "PC30", liters: "50" });

  await openThisCycle(page);
  const row = page.getByRole("row").filter({ hasText: "DEMO1" });
  await expect(row).toContainText("3,250.00");
  await expect(row).toContainText("ต้องตรวจ: มีใบยังไม่เซ็นรับ 1 ใบ");
  await expect(page.getByText("ตรวจก่อนปิดรอบ")).toBeVisible();
});

test("closing carries the unsigned slip on, locks the signed one and the invoice moves through its steps", async ({ page }) => {
  await login(page, "store");
  await openThisCycle(page);
  await page.getByRole("button", { name: /^ปิดรอบ/ }).click();
  await expect(page.getByText("จะไม่อยู่ในใบแจ้งของรอบนี้", { exact: false })).toBeVisible();
  await page.getByRole("region", { name: /^ปิดรอบ/ }).getByRole("button", { name: /^ปิดรอบ/ }).click();
  await expect(page.getByRole("status")).toContainText("ยกใบที่ยังไม่เซ็นรับ 1 ใบ");
  await expect(page.getByText("ปิดรอบแล้วเมื่อ")).toBeVisible();
  // the writer cannot reopen
  await expect(page.getByRole("button", { name: "เปิดรอบอีกครั้ง" })).toHaveCount(0);

  // signed slip is locked
  await page.goto("/issues?q=9");
  await page.getByRole("link", { name: "9 / 1" }).click();
  await expect(page.getByTestId("lock-note")).toContainText("ปิดแล้ว");

  // the carried slip can still be signed (it now sits in the next cycle)
  await page.goto("/issues?q=9");
  await page.getByRole("link", { name: "9 / 2" }).click();
  await signCurrentSlip(page, "สมหญิง");

  // invoice of DEMO1: only the signed slip, then walk the status
  await openThisCycle(page);
  await page.getByRole("link", { name: "เปิดใบแจ้ง" }).first().click();
  const sheet = page.locator(".invoice-sheet");
  await expect(sheet).toContainText("3,250.00");
  await expect(sheet).toContainText("PC210");
  await expect(sheet).not.toContainText("PC30");
  await page.getByRole("button", { name: "เปลี่ยนเป็น ส่งให้ PM แล้ว" }).click();
  await expect(page.getByText("ส่งให้ PM แล้ว (ตอนนี้)")).toBeVisible();
});

test("only the system admin reopens, with a reason, and invoices go back to draft", async ({ page }) => {
  await login(page, "admin");
  await openThisCycle(page);
  await page.getByRole("button", { name: "เปิดรอบอีกครั้ง" }).click();
  const box = page.getByRole("region", { name: /^เปิดรอบ/ });
  await expect(box).toContainText("ซึ่งต้องออกและเซ็นใหม่");
  await box.getByRole("button", { name: "เปิดรอบอีกครั้ง" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ต้องใส่เหตุผล" })).toBeVisible();
  await box.getByLabel("เหตุผลที่เปิดรอบ").fill("พบใบตกหล่น");
  await box.getByRole("button", { name: "เปิดรอบอีกครั้ง" }).click();
  await expect(page.getByText("ยังไม่ปิดรอบ")).toBeVisible();
  await expect(page.getByText("เหตุผล: พบใบตกหล่น")).toBeVisible();
});

test("a project viewer sees invoices but has no close button", async ({ page }) => {
  await login(page, "viewer");
  await page.goto("/invoices");
  await expect(page.getByRole("button", { name: /^ปิดรอบ/ })).toHaveCount(0);
});
