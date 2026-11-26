import { expect, test, type Page } from "@playwright/test";
import { attachBill, keyIssue, login, recordPurchase, resetData } from "./helpers";

// BA rulings of 22 Nov (sheet "MYOIL: คำตัดสิน BA จากผลทดสอบ"): OBS-13, OBS-17, OBS-18

test.describe.configure({ mode: "serial" });
test.beforeAll(resetData);

async function openPurchaseForm(page: Page, month: string) {
  await page.goto(`/purchases?month=${month}&new=purchase`);
  return page.getByRole("form", { name: "บันทึกการซื้อ" });
}

test("OBS-17: a purchase that looks odd is asked about, not refused", async ({ page }) => {
  await login(page, "store");
  const form = await openPurchaseForm(page, "2026-04");
  await form.getByLabel("วันที่").fill("2026-04-05");
  await form.getByLabel("เติมเข้า (ลิตร)").fill("50");
  await form.getByLabel("ราคาต่อลิตร (บาท)").fill("40");
  await attachBill(form);
  await form.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(form.getByText("ซื้อน้อยกว่า 100 ลิตร")).toBeVisible();
  await form.getByRole("button", { name: "ยืนยันบันทึก" }).click();
  await expect(page).toHaveURL(/\/purchases\?month=2026-04$/);
  await expect(page.locator("table").first().getByRole("row").filter({ hasText: "05/04/69" })).toContainText("2,000.00");
});

test("OBS-18: a saved purchase can be edited, cancelled with a reason, and restored", async ({ page }) => {
  await login(page, "store");
  const form = await openPurchaseForm(page, "2026-04");
  await form.getByLabel("วันที่").fill("2026-04-10");
  await form.getByLabel("เติมเข้า (ลิตร)").fill("1000");
  await form.getByLabel("ราคาต่อลิตร (บาท)").fill("40");
  await attachBill(form);
  await form.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page).toHaveURL(/\/purchases\?month=2026-04$/);

  const row = () => page.locator("table").first().getByRole("row").filter({ hasText: "10/04/69" });
  await row().getByRole("link", { name: "แก้ไข" }).click();
  const edit = page.getByRole("form", { name: "แก้ไขการซื้อ" });
  await edit.getByLabel("เติมเข้า (ลิตร)").fill("1200");
  // OBS-05 (BA, 26 Nov 2026): a changed bill needs a reason
  await edit.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(edit.getByText("ใส่เหตุผลที่แก้ไขรายการซื้อ")).toBeVisible();
  await edit.getByLabel("เหตุผลที่แก้ไข").fill("คีย์ลิตรผิดจากบิล");
  await edit.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page).toHaveURL(/\/purchases\?month=2026-04$/);
  await expect(row()).toContainText("48,000.00");
  await row().getByText(/^ประวัติ/).click();
  await expect(row()).toContainText("ลิตร: 1000 → 1200");

  // cancel needs a reason
  await row().getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await row().getByRole("button", { name: "ยืนยันยกเลิก" }).click();
  await expect(row().getByRole("alert")).toContainText("ใส่เหตุผลที่ยกเลิก");
  await row().getByLabel("เหตุผลที่ยกเลิกรายการซื้อ").fill("คีย์ผิดวัน");
  await row().getByRole("button", { name: "ยืนยันยกเลิก" }).click();
  await expect(row()).toContainText("ยกเลิกแล้ว: คีย์ผิดวัน");

  // a cancelled purchase counts nowhere
  await page.goto("/ledger?month=2026-04");
  await expect(page.getByText("เติมเข้ารวม").locator("..")).not.toContainText("1,200.00");

  await page.goto("/purchases?month=2026-04");
  await row().getByRole("button", { name: "นำกลับมา" }).click();
  await expect(row().getByRole("link", { name: "แก้ไข" })).toBeVisible();
});

test("OBS-13: a signed slip with no price blocks closing the cycle until the day's price is set", async ({ page }) => {
  await login(page, "store");
  await keyIssue(page, { book: "8", doc: "1", date: "2026-01-15", machine: "PC210", liters: "100" });
  await page.getByRole("button", { name: "ติ๊กว่าเซ็นรับแล้ว" }).click();
  await page.getByLabel("ชื่อผู้เซ็นรับ").fill("สมชาย");
  await page.getByRole("button", { name: "บันทึกว่าเซ็นรับแล้ว" }).click();
  await expect(page.getByText("ผู้เซ็นรับ: - → สมชาย")).toBeVisible();
  await page.goto("/issues?q=8");
  await expect(page.getByRole("row").filter({ hasText: "8 / 1" })).not.toContainText("อยู่ในใบแจ้งแล้ว");

  await page.goto("/invoices");
  await page.getByRole("button", { name: /^ปิดรอบ/ }).click();
  await page.getByRole("region", { name: /^ปิดรอบ/ }).getByRole("button", { name: /^ปิดรอบ/ }).click();
  await expect(page.getByText(/ปิดรอบไม่ได้ มีใบที่เซ็นรับแล้วแต่ยังรอราคา 1 ใบ/)).toBeVisible();

  // record the purchase bill of that day (the slip takes its price), then closing works
  await recordPurchase(page, { date: "2026-01-15", liters: "1000", price: "30" });
  await page.goto("/invoices");
  await page.getByRole("button", { name: /^ปิดรอบ/ }).click();
  await page.getByRole("region", { name: /^ปิดรอบ/ }).getByRole("button", { name: /^ปิดรอบ/ }).click();
  // (the page then moves on to the next cycle that still waits, so check the message, not the old cycle's header)
  await expect(page.getByRole("status")).toContainText("ปิดรอบแล้ว");
});
