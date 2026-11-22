import { expect, test } from "@playwright/test";
import { keyIssue, login, recordPurchase, resetData } from "./helpers";

const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser, baseURL }) => {
  resetData();
  const page = await browser.newPage({ baseURL });
  await login(page, "store");
  await recordPurchase(page, { date: TODAY, liters: "1000", price: "32.5" }); // same as the price the seed sets for today, so no "price differs" warning
  await keyIssue(page, { book: "5", doc: "1", date: TODAY, project: "DEMO1", machine: "O-A", liters: "300" });
  await keyIssue(page, { book: "5", doc: "2", date: TODAY, project: "DEMO2", machine: "O-B", liters: "100" });
  await page.close();
});

test("the tank shows stock and today's movement", async ({ page }) => {
  await login(page, "store");
  const tank = page.getByRole("region", { name: "คงเหลือในรถเติมน้ำมัน" });
  await expect(tank).toContainText("เติมเข้าวันนี้");
  await expect(tank).toContainText("1,000 ลิตร"); // in today
  await expect(tank).toContainText("400 ลิตร"); // out today
  await expect(tank.getByRole("img")).toHaveAttribute("aria-label", /คงเหลือ 600 ลิตร/);
});

test("projects are listed biggest first with totals", async ({ page }) => {
  await login(page, "store");
  const rows = page.locator("table.t tbody tr");
  await expect(rows.nth(0)).toContainText("DEMO1");
  await expect(rows.nth(0)).toContainText("300");
  await expect(rows.nth(1)).toContainText("DEMO2");
  await expect(page.locator("table.t tfoot")).toContainText("400");
});

test("slips not signed for are a to-do item that links to them", async ({ page }) => {
  await login(page, "store");
  await expect(page.getByText(/ต้องตามงาน \d+ เรื่อง/)).toBeVisible();
  await page.getByRole("link", { name: "ดูใบที่ยังไม่เซ็นรับ" }).click();
  await expect(page).toHaveURL(/signed=no/);
  await expect(page.getByRole("row").filter({ hasText: "O-A" })).toBeVisible();
});

test("a project viewer sees no tank and no to-do list", async ({ page }) => {
  await login(page, "viewer");
  await expect(page.getByRole("region", { name: "คงเหลือในรถเติมน้ำมัน" })).toHaveCount(0);
  await expect(page.getByText(/ต้องตามงาน/)).toHaveCount(0);
});

test("an executive sees the tank but cannot record a slip", async ({ page }) => {
  await login(page, "exec");
  await expect(page.getByRole("region", { name: "คงเหลือในรถเติมน้ำมัน" })).toBeVisible();
  await expect(page.getByRole("link", { name: "บันทึกใบจ่าย" })).toHaveCount(0);
});

test("the slips card opens the list for the real last day of the month (BUG-01)", async ({ page }) => {
  await login(page, "store");
  await page.getByRole("link", { name: /ใบจ่าย.*ใบ/ }).first().click();
  await expect(page).toHaveURL(/\/issues\?from=\d{4}-\d{2}-01&to=\d{4}-\d{2}-(28|29|30|31)$/);
  await expect(page.getByRole("heading", { name: "ใบจ่ายน้ำมัน" })).toBeVisible();
});

test("a date that does not exist in the link is told, not a crash (BUG-01)", async ({ page }) => {
  await login(page, "store");
  const res = await page.goto("/issues?from=2026-11-01&to=2026-11-31");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("วันที่ในลิงก์ไม่ถูกต้อง")).toBeVisible();
});

test("a month with a purchase is offered on every month page (BUG-03)", async ({ page }) => {
  await login(page, "store");
  await recordPurchase(page, { date: "2026-01-15", liters: "500", price: "40" });
  for (const path of ["/purchases", "/ledger", "/monthly"]) {
    await page.goto(path);
    await expect(page.locator("select option", { hasText: "ม.ค. 2569" })).toHaveCount(1);
  }
});
