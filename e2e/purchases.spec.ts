import { expect, test } from "@playwright/test";
import { login, recordPurchase, resetData } from "./helpers";

// fixed past month: the tests do not depend on today's date
const DAY = "2026-01-15";
const MONTH = "2026-01";

test.describe.configure({ mode: "serial" });
test.beforeAll(resetData);

test("two of three numbers are enough: the third is shown before saving", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/purchases?month=${MONTH}&new=purchase`);
  const form = page.getByRole("form", { name: "บันทึกการซื้อ" });
  await form.getByLabel("เติมเข้า (ลิตร)").fill("1000");
  await form.getByLabel("ราคาต่อลิตร (บาท)").fill("40");
  await expect(form.getByLabel("จำนวนเงิน (บาท)")).toHaveAttribute("placeholder", "40,000.00");
});

test("three numbers that disagree are refused", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/purchases?month=${MONTH}&new=purchase`);
  const form = page.getByRole("form", { name: "บันทึกการซื้อ" });
  await form.getByLabel("วันที่").fill(DAY);
  await form.getByLabel("เติมเข้า (ลิตร)").fill("1000");
  await form.getByLabel("ราคาต่อลิตร (บาท)").fill("40");
  await form.getByLabel("จำนวนเงิน (บาท)").fill("41000");
  await form.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("จำนวนเงินไม่ตรง");
});

test("a purchase appears in the list and sets that day's price", async ({ page }) => {
  await login(page, "store");
  await recordPurchase(page, { date: DAY, liters: "1000", price: "40", billNo: "B-001" });

  const row = page.getByRole("row").filter({ hasText: "B-001" });
  await expect(row).toContainText("15/01/69");
  await expect(row).toContainText("1,000.00");
  await expect(row).toContainText("40,000.00");
  await expect(page.getByRole("row").filter({ hasText: "รวม 1 ครั้ง" })).toContainText("40,000.00");

  const price = page.getByRole("row").filter({ hasText: "จากการซื้อวันนั้น" });
  // runs until the day before the next price (the seeded price of today), so it is not "ยังใช้อยู่"
  await expect(price).toContainText("15/01/69");
  await expect(price).toContainText("40.00");
});

test("a second purchase at another price keeps the day's price and says so", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/purchases?month=${MONTH}&new=purchase`);
  const form = page.getByRole("form", { name: "บันทึกการซื้อ" });
  await form.getByLabel("วันที่").fill(DAY);
  await form.getByLabel("เติมเข้า (ลิตร)").fill("500");
  await form.getByLabel("ราคาต่อลิตร (บาท)").fill("41");
  await form.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(form.getByRole("status")).toContainText("ไม่ตรงกับราคาที่ซื้อ");
  await form.getByRole("button", { name: "รับทราบ" }).click();
  await expect(page.getByRole("row").filter({ hasText: "รวม 2 ครั้ง" })).toBeVisible();
});

test("a price for a day with no purchase can be set, then corrected", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/purchases?month=${MONTH}`);
  await page.getByRole("link", { name: "ตั้งราคาของวันที่ไม่มีการซื้อ" }).click();
  const form = page.getByRole("form", { name: "ตั้งราคาประจำวัน" });
  await form.getByLabel("วันที่").fill("2026-01-20");
  await form.getByLabel("ราคาต่อลิตร (บาท)").fill("41.5");
  await form.getByRole("button", { name: "บันทึก", exact: true }).click();

  const row = page.getByRole("row").filter({ hasText: "ตั้งเอง วันนั้นไม่มีการซื้อ" });
  await expect(row).toContainText("41.50");
  await expect(row).toContainText("20/01/69");

  await row.getByRole("link", { name: "แก้ราคา" }).click();
  const edit = page.getByRole("form", { name: "ตั้งราคาประจำวัน" });
  await expect(edit.getByLabel("ราคาต่อลิตร (บาท)")).toHaveValue("41.5");
  await edit.getByLabel("ราคาต่อลิตร (บาท)").fill("42");
  await edit.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "ตั้งเอง วันนั้นไม่มีการซื้อ" })).toContainText("42.00");
});

test("the month dropdown opens another month", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/purchases?month=${MONTH}`);
  await expect(page.getByRole("heading", { name: /การซื้อ ม\.ค\. 2569/ })).toBeVisible();
  await page.getByLabel("เดือน").selectOption({ index: 0 }); // newest month (the current one)
  await expect(page).not.toHaveURL(new RegExp(`month=${MONTH}`));
});
