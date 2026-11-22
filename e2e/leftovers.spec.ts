import { expect, test } from "@playwright/test";
import { keyIssue, login, recordPurchase, resetData } from "./helpers";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => resetData());

// 1×1 PNG: the browser really decodes it, then re-encodes it as a small JPEG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("a note typed in the ledger stays after reload", async ({ page }) => {
  await login(page, "store");
  await recordPurchase(page, { date: "2026-03-02", liters: "500", price: "40" });
  await page.goto("/ledger?month=2026-03");
  const box = page.getByRole("textbox", { name: /^หมายเหตุ/ }).first();
  await box.fill("น้ำมันเข้าตอนเช้า");
  await box.press("Enter");
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole("textbox", { name: /^หมายเหตุ/ }).first()).toHaveValue("น้ำมันเข้าตอนเช้า");
});

test("a bill photo can be attached and opened", async ({ page }) => {
  await login(page, "store");
  await page.goto("/purchases?month=2026-03&new=purchase");
  const form = page.getByRole("form", { name: "บันทึกการซื้อ" });
  await form.getByLabel("วันที่").fill("2026-03-03");
  await form.getByLabel("เติมเข้า (ลิตร)").fill("100");
  await form.getByLabel("ราคาต่อลิตร (บาท)").fill("40");
  await form.getByLabel(/รูปบิล/).setInputFiles({ name: "bill.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(form.getByText("แนบแล้ว: bill.png")).toBeVisible();
  await form.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page).toHaveURL(/\/purchases\?month=2026-03$/);
  const link = page.getByRole("link", { name: "ดูรูปบิล" });
  await expect(link).toHaveCount(1);
  const res = await page.request.get((await link.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/jpeg");
});

test("a price entered later reprices an open slip that was waiting", async ({ page }) => {
  await login(page, "store");
  await keyIssue(page, { book: "9", doc: "1", date: "2026-02-01", machine: "L-A", liters: "10" });
  await expect(page.getByText("รอราคา").first()).toBeVisible();
  await page.goto("/purchases?month=2026-02");
  await page.getByRole("link", { name: "ตั้งราคาของวันที่ไม่มีการซื้อ" }).click();
  const form = page.getByRole("form", { name: "ตั้งราคาประจำวัน" });
  await form.getByLabel("วันที่").fill("2026-02-01");
  await form.getByLabel("ราคาต่อลิตร (บาท)").fill("40");
  await form.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "ตั้งเอง วันนั้นไม่มีการซื้อ" })).toContainText("40.00"); // saved
  await page.goto("/issues");
  await expect(page.getByRole("row").filter({ hasText: "L-A" })).toContainText("400.00");
});
