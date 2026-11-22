import { expect, test } from "@playwright/test";
import { keyIssue, login, recordPurchase, resetData } from "./helpers";

// fixed past month, so every number below is exact
const MONTH = "2026-02";

test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser, baseURL }) => {
  resetData();
  const page = await browser.newPage({ baseURL });
  await login(page, "store");
  await recordPurchase(page, { date: "2026-02-09", liters: "1000", price: "40" }); // +1,000
  await keyIssue(page, { book: "3", doc: "1", date: "2026-02-10", machine: "L-A", liters: "400" }); // −400 → 600
  await keyIssue(page, { book: "3", doc: "2", date: "2026-02-11", machine: "L-B", liters: "1000" }); // −1,000 → −400
  await page.close();
});

test("the summary and the daily rows add up", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/ledger?month=${MONTH}`);
  await expect(page.getByText("ยกมา", { exact: true }).locator("..")).toContainText("0.00");
  await expect(page.getByText("เติมเข้ารวม").locator("..")).toContainText("1,000.00");
  await expect(page.getByText("จ่ายออกรวม").locator("..")).toContainText("1,400.00");
  await expect(page.getByText("คงเหลือ", { exact: true }).locator("..")).toContainText("-400.00");
  await expect(page.getByRole("row").filter({ hasText: /^\s*9 ก\.พ\. 69/ })).toContainText("40,000.00");
  await expect(page.getByRole("row").filter({ hasText: "10 ก.พ. 69" })).toContainText("600.00");
});

test("a negative balance is shown in words, not only in colour", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/ledger?month=${MONTH}`);
  await expect(page.getByRole("row").filter({ hasText: "11 ก.พ. 69" })).toContainText("-400.00 ติดลบ");
});

test("the amount issued links to that day's slips", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/ledger?month=${MONTH}`);
  await page.getByRole("row").filter({ hasText: "10 ก.พ. 69" }).getByRole("link", { name: "400.00" }).click();
  await expect(page).toHaveURL(/\/issues\?from=2026-02-10&to=2026-02-10/);
  await expect(page.getByRole("row").filter({ hasText: "L-A" })).toBeVisible();
});

test("a measured amount is compared with the book and kept", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/ledger?month=${MONTH}`);
  const row = page.getByRole("row").filter({ hasText: "10 ก.พ. 69" });
  const box = row.getByLabel(/ยอดที่วัดได้จริง/);

  await box.fill("600");
  await box.blur();
  await expect(row).toContainText("ตรงกัน");

  await box.fill("590");
  await box.blur();
  await expect(row).toContainText("-10.00 ไม่ตรง");

  await page.reload();
  await expect(row.getByLabel(/ยอดที่วัดได้จริง/)).toHaveValue("590.00");

  await row.getByLabel(/ยอดที่วัดได้จริง/).fill("");
  await row.getByLabel(/ยอดที่วัดได้จริง/).blur();
  await expect(row).not.toContainText("ไม่ตรง");
});

test("executive can read the book but not change it", async ({ page }) => {
  await login(page, "exec");
  await page.goto(`/ledger?month=${MONTH}`);
  await expect(page.getByRole("row").filter({ hasText: "11 ก.พ. 69" })).toContainText("ติดลบ");
  await expect(page.getByLabel(/ยอดที่วัดได้จริง/)).toHaveCount(0);
});

test("the month can be exported to Excel", async ({ page }) => {
  await login(page, "store");
  const res = await page.request.get(`/ledger/export?month=${MONTH}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("spreadsheetml");
  expect((await res.body()).byteLength).toBeGreaterThan(1000);
});

test("the export is closed to a role that cannot open the book", async ({ page }) => {
  await login(page, "viewer");
  const res = await page.request.get(`/ledger/export?month=${MONTH}`);
  expect(res.status()).toBe(403);
});

test("text in the measured box is refused out loud, not silently (OBS-09)", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/ledger?month=${MONTH}`);
  const row = page.getByRole("row").filter({ hasText: "10 ก.พ. 69" });
  await row.getByLabel(/ยอดที่วัดได้จริง/).fill("abc");
  await row.getByLabel(/ยอดที่วัดได้จริง/).blur();
  await expect(row.getByRole("alert")).toContainText("ใส่เป็นตัวเลข");
});
