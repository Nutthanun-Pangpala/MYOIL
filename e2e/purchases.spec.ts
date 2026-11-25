import { expect, test } from "@playwright/test";
import { keyIssue, login, recordPurchase, resetData } from "./helpers";

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

test("a purchase appears in the list with its totals", async ({ page }) => {
  await login(page, "store");
  await recordPurchase(page, { date: DAY, liters: "1000", price: "40", billNo: "B-001" });

  const row = page.getByRole("row").filter({ hasText: "B-001" });
  await expect(row).toContainText("15/01/69");
  await expect(row).toContainText("1,000.00");
  await expect(row).toContainText("40,000.00");
  await expect(page.getByRole("row").filter({ hasText: "รวม 1 ครั้ง" })).toContainText("40,000.00");

  // no daily price list (owner, 25 Nov 2026): the page says how slips are priced instead, and the bill shows its time
  await expect(page.getByText("ใบจ่ายใช้น้ำมันของบิลที่เข้าก่อนให้หมดก่อน")).toBeVisible();
  await expect(row).toContainText(/\d\d:\d\d น\./);
  await expect(page.getByRole("link", { name: "ตั้งราคาของวันที่ไม่มีการซื้อ" })).toHaveCount(0);
});

test("oldest fuel first: a slip that crosses two bills is split into two prices; cancelling the second bill asks first", async ({ page }) => {
  await login(page, "store");
  // B-001 (1,000 liters at 40.00) is the only fuel: a small slip takes all its liters from it
  await keyIssue(page, { book: "3", doc: "1", date: "2026-01-20", machine: "BILL-A", liters: "10" });
  await expect(page.getByTestId("price-parts")).toContainText("× 40.00 = 400.00 บาท");
  await expect(page.getByTestId("price-parts")).toContainText("เลขที่ B-001");

  // a second bill does not touch the slip already priced: the first bill still has liters left (no question, no note)
  await recordPurchase(page, { date: DAY, liters: "500", price: "41", billNo: "B-002" });
  await expect(page.getByRole("row").filter({ hasText: "รวม 2 ครั้ง" })).toBeVisible();
  await page.goto("/issues");
  await expect(page.getByRole("row").filter({ hasText: "BILL-A" })).toContainText("400.00");

  // 1,000 liters: the 990 left of B-001 at 40.00, then 10 from B-002 at 41.00 (brief §14 B3)
  await keyIssue(page, { book: "3", doc: "2", date: "2026-01-20", machine: "BILL-B", liters: "1000" });
  await expect(page.getByTestId("price-parts")).toContainText("× 40.00 = 39,600.00 บาท");
  await expect(page.getByTestId("price-parts")).toContainText("× 41.00 = 410.00 บาท");
  await page.goto("/issues");
  await expect(page.getByRole("row").filter({ hasText: "BILL-B" })).toContainText("40,010.00");

  // B5: cancelling B-002 would change that slip, so it is said first; after "ยืนยันทำต่อ" its last 10 liters wait for a price (B7)
  await page.goto(`/purchases?month=${MONTH}`);
  const bill = page.getByRole("row").filter({ hasText: "B-002" });
  await bill.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await page.getByLabel("เหตุผลที่ยกเลิกรายการซื้อ").fill("e2e ยกเลิกบิลที่สอง");
  await page.getByRole("button", { name: "ยืนยันยกเลิก" }).click();
  await expect(page.getByText("ใบจ่าย 1 ใบในรอบที่ยังไม่ปิดจะเปลี่ยนยอดเงิน")).toBeVisible();
  await page.getByRole("button", { name: "ยืนยันทำต่อ" }).click();
  await expect(page.getByText("ยกเลิกแล้ว: e2e ยกเลิกบิลที่สอง")).toBeVisible();
  await page.goto("/issues");
  await expect(page.getByRole("row").filter({ hasText: "BILL-B" })).toContainText("รอราคา");
  await expect(page.getByRole("row").filter({ hasText: "BILL-A" })).toContainText("400.00");
});

test("the month dropdown opens another month", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/purchases?month=${MONTH}`);
  await expect(page.getByRole("heading", { name: /การซื้อ ม\.ค\. 2569/ })).toBeVisible();
  await page.getByLabel("เดือน").selectOption({ index: 0 }); // newest month (the current one)
  await expect(page).not.toHaveURL(new RegExp(`month=${MONTH}`));
});
