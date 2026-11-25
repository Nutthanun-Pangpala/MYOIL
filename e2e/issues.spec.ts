import { expect, test } from "@playwright/test";
import { keyIssue, login, resetData } from "./helpers";

// 1×1 PNG: the browser really decodes it, then re-encodes it as a small JPEG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

test.describe.configure({ mode: "serial" });
test.beforeAll(resetData);

test("keying a slip for today uses the seeded price of 32.50", async ({ page }) => {
  await login(page, "store");
  await keyIssue(page, { book: "1", doc: "1", date: TODAY, machine: "PC210", liters: "100" });
  await expect(page.getByText("3,250.00").first()).toBeVisible();
  await page.goto("/issues");
  await expect(page.getByRole("row").filter({ hasText: "PC210" })).toContainText("3,250.00");
});

test("the same book and number cannot be keyed twice", async ({ page }) => {
  await login(page, "store");
  await page.goto("/issues/new");
  await page.getByLabel("เล่มที่").fill("1");
  await page.getByLabel("เลขที่", { exact: true }).fill("1");
  await page.getByLabel(/^วันที่/).fill(TODAY);
  await page.getByLabel("โครงการ").fill("DEMO1");
  await page.getByLabel("รายการหรือรหัสเครื่องจักร").first().fill("PC210");
  await page.getByLabel("จำนวนน้ำมัน (ลิตร)").first().fill("10");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText("เล่มที่และเลขที่นี้มีอยู่แล้วในระบบ").first()).toBeVisible();
  await expect(page).toHaveURL(/\/issues\/new/);
});

test("the receiver's name is needed only when the paper copy is ticked as signed", async ({ page }) => {
  await login(page, "store");
  await page.goto("/issues/new");
  // a click that lands before the page has hydrated is thrown away, so try until it sticks
  await expect(async () => {
    await page.getByLabel("ใบกระดาษมีลายเซ็นแล้ว").check();
  }).toPass();
  await page.getByLabel(/ผู้เซ็นรับ/).focus();
  await page.getByLabel(/ผู้เซ็นรับ/).blur();
  await expect(page.getByText("ใส่ชื่อผู้เซ็นรับ")).toBeVisible();
  await page.getByLabel("ใบกระดาษมีลายเซ็นแล้ว").uncheck();
  await expect(page.getByText("ใส่ชื่อผู้เซ็นรับ")).toHaveCount(0);
});

test("a slip with no purchase bill before it waits, and is priced when the bill is recorded", async ({ page }) => {
  await login(page, "store");
  await keyIssue(page, { book: "2", doc: "1", date: "2026-01-15", machine: "WAITING-1", liters: "100" });
  await page.goto("/issues");
  const row = page.getByRole("row").filter({ hasText: "WAITING-1" });
  await expect(row).toContainText("รอราคา");

  await page.goto("/purchases?month=2026-01&new=purchase");
  const form = page.getByRole("form", { name: "บันทึกการซื้อ" });
  await form.getByLabel("วันที่").fill("2026-01-15");
  await form.getByLabel("เติมเข้า (ลิตร)").fill("1000");
  await form.getByLabel("ราคาต่อลิตร (บาท)").fill("40");
  await form.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(form.getByRole("status")).toContainText("ตั้งราคาให้ใบจ่ายที่รอราคาแล้ว 1 รายการ");

  await page.goto("/issues");
  const priced = page.getByRole("row").filter({ hasText: "WAITING-1" });
  await expect(priced).toContainText("4,000.00");
  await expect(priced).not.toContainText("รอราคา");
});

test("a slip ticked as signed saves as soon as the name is typed (BUG-04)", async ({ page }) => {
  await login(page, "store");
  await page.goto("/issues/new");
  await page.getByLabel("เล่มที่").fill("7");
  await page.getByLabel("เลขที่", { exact: true }).fill("70");
  await page.getByLabel(/^วันที่/).fill(TODAY);
  await page.getByLabel("โครงการ").fill("DEMO1");
  await page.getByLabel("รายการหรือรหัสเครื่องจักร").first().fill("PC210");
  await page.getByLabel("จำนวนน้ำมัน (ลิตร)").first().fill("10");
  await page.getByLabel("ใบกระดาษมีลายเซ็นแล้ว").check();
  await page.getByLabel(/ผู้เซ็นรับ/).fill("สมชาย");
  // no pause: the save must not wait for, or be blocked by, the server's earlier answer
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page).toHaveURL(/\/issues\/[0-9a-f-]{36}/);
  await expect(page.getByText("สมชาย")).toBeVisible();
  await expect(page.getByText("ยังไม่เซ็นรับ")).toHaveCount(0);
});

test("liters with a third decimal are refused at the field, not rounded (BA 22 Nov)", async ({ page }) => {
  await login(page, "store");
  await page.goto("/issues/new");
  await page.getByLabel("เล่มที่").fill("8");
  await page.getByLabel("เลขที่", { exact: true }).fill("80");
  await page.getByLabel(/^วันที่/).fill(TODAY);
  await page.getByLabel("โครงการ").fill("DEMO1");
  await page.getByLabel("รายการหรือรหัสเครื่องจักร").first().fill("PC210");
  await page.getByLabel("จำนวนน้ำมัน (ลิตร)").first().fill("10.555");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ไม่เกิน 2 ตำแหน่ง" })).toBeVisible();
  // OBS-19: no totals computed from the refused value
  await expect(page.getByText("แก้ลิตรให้ถูกต้องก่อน")).toBeVisible();
  await expect(page).toHaveURL(/\/issues\/new/);
});

test.describe("changing a saved slip", () => {
  test("tick signed needs a name, then the slip shows it and the history says so", async ({ page }) => {
    await login(page, "store");
    await keyIssue(page, { book: "7", doc: "1", date: TODAY, machine: "PC210", liters: "10" });
    await expect(page.getByText("ยังไม่เซ็นรับ").first()).toBeVisible();
    await page.getByRole("button", { name: "ติ๊กว่าเซ็นรับแล้ว" }).click();
    await page.getByRole("button", { name: "บันทึกว่าเซ็นรับแล้ว" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "ใส่ชื่อผู้เซ็นรับ" })).toBeVisible();
    await page.getByLabel("ชื่อผู้เซ็นรับ").fill("สมชาย");
    await page.getByRole("button", { name: "บันทึกว่าเซ็นรับแล้ว" }).click();
    await expect(page.getByText("สมชาย", { exact: true })).toBeVisible();
    await expect(page.getByText("ผู้เซ็นรับ: - → สมชาย")).toBeVisible();
  });

  test("editing liters re-prices the slip", async ({ page }) => {
    await login(page, "store");
    await keyIssue(page, { book: "7", doc: "2", date: TODAY, machine: "PC210", liters: "10" });
    await page.getByRole("link", { name: "แก้ไข", exact: true }).click();
    await page.getByLabel("จำนวนน้ำมัน (ลิตร)").first().fill("20");
    await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
    await expect(page.getByText("650.00").first()).toBeVisible(); // 20 × 32.50
    await expect(page.getByText("รายการ: PC210 10 ลิตร → PC210 20 ลิตร")).toBeVisible(); // OBS-11
    await expect(page.getByRole("list", { name: "ประวัติการแก้ไข" })).toContainText("แก้ไข");
  });

  test("cancel needs a reason; a cancelled slip is out of the list count and can be restored", async ({ page }) => {
    await login(page, "store");
    await keyIssue(page, { book: "7", doc: "3", date: TODAY, machine: "PC30", liters: "10" });
    // design 6.5: "ยกเลิกใบ" opens a confirm window; the red button in it does the cancel
    await page.getByRole("button", { name: "ยกเลิกใบ", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ยกเลิกใบนี้" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "ใส่เหตุผลที่ยกเลิก" })).toBeVisible();
    await page.getByLabel("เหตุผลที่ยกเลิก").fill("คีย์ซ้ำ");
    await page.getByRole("dialog").getByRole("button", { name: "ยกเลิกใบนี้" }).click();
    await expect(page.getByText("ยกเลิกแล้ว — เหตุผล: คีย์ซ้ำ")).toBeVisible();
    await expect(page.getByRole("link", { name: "แก้ไข", exact: true })).toHaveCount(0);

    await page.goto("/issues?status=cancelled&machine=PC30");
    await expect(page.getByRole("row").filter({ hasText: "7 / 3" })).toContainText("ยกเลิก");

    await page.getByRole("link", { name: "7 / 3" }).click();
    await page.getByRole("button", { name: "นำกลับมา" }).click();
    await expect(page.getByRole("link", { name: "แก้ไข", exact: true })).toBeVisible();
  });

  test("the list filters by machine and exports", async ({ page }) => {
    await login(page, "store");
    await page.goto("/issues?machine=PC30");
    await expect(page.getByRole("row").filter({ hasText: "7 / 3" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "7 / 1" })).toHaveCount(0);
    const res = await page.request.get("/issues/export?machine=PC30");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
  });
});

test("a photo of the signed paper can be attached with the new slip, replaced and removed", async ({ page }) => {
  await login(page, "store");
  await page.goto("/issues/new");
  await page.getByLabel("เล่มที่").fill("9");
  await page.getByLabel("เลขที่", { exact: true }).fill("91");
  await page.getByLabel(/^วันที่/).fill(TODAY);
  await page.getByLabel("โครงการ").fill("DEMO1");
  await page.getByLabel("รายการหรือรหัสเครื่องจักร").first().fill("PC210");
  await page.getByLabel("จำนวนน้ำมัน (ลิตร)").first().fill("5");
  await page.getByLabel(/รูปใบเซ็น/).setInputFiles({ name: "signed.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page.getByText("แนบแล้ว: signed.png")).toBeVisible();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page).toHaveURL(/\/issues\/[0-9a-f-]{36}/);

  // the picture is on the slip's page and the server really serves it as an image
  const img = page.getByAltText("รูปใบจ่ายที่เซ็นแล้ว");
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  const res = await page.request.get(src!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/jpeg");

  // replace it
  await page.locator("#signed-photo").setInputFiles({ name: "again.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page.getByRole("status").filter({ hasText: "เปลี่ยนรูปแล้ว" })).toBeVisible();
  await expect(page.getByText("รูปใบเซ็น: มีรูป → เปลี่ยนรูปแล้ว")).toBeVisible();

  // remove it: asks first
  await page.getByRole("button", { name: "ลบรูป" }).click();
  await page.getByRole("button", { name: "ลบ", exact: true }).click();
  await expect(page.getByText("ยังไม่มีรูปใบเซ็น")).toBeVisible();
  await expect(page.getByText("รูปใบเซ็น: มีรูป → ลบรูปแล้ว")).toBeVisible();
  expect((await page.request.get(src!)).status()).toBe(404);
});

test("a file that is not a picture is refused with a message, nothing is saved", async ({ page }) => {
  await login(page, "store");
  await page.goto("/issues");
  await page.getByRole("row").filter({ hasText: "PC210" }).first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/issues\/[0-9a-f-]{36}/);
  await page.locator("#signed-photo").setInputFiles({ name: "x.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await expect(page.getByRole("alert").filter({ hasText: "เปิดรูปนี้ไม่ได้" })).toBeVisible();
  await expect(page.getByText("ยังไม่มีรูปใบเซ็น")).toBeVisible();
});
