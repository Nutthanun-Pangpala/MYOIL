import { expect, test, type Page } from "@playwright/test";
import { login, loginDriver, planStops, resetData } from "./helpers";

/**
 * Stage 2 of the driver's move into MYOIL (design "MYOIL — หน้าจอฝั่ง พขร. (ขั้นที่ 2)"):
 * stop → fill → machine → meter photo (Chrome's fake camera) → liters → signature → the slip reaches the office.
 */
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  resetData();
  planStops(TODAY, ["DEMO1", "DEMO2"]);
});

async function addMachine(page: Page, name: string, liters: string) {
  await page.getByRole("button", { name: "เพิ่มเครื่องจักร" }).click();
  await page.getByRole("button", { name: "เครื่องใหม่ พิมพ์รหัสหรือชื่อเอง" }).click();
  await page.getByLabel("พิมพ์ตามป้ายหรือทะเบียนที่ตัวเครื่อง").fill(name);
  await page.getByRole("button", { name: "ใช้ชื่อนี้ ไปถ่ายรูปมิเตอร์" }).click();
  await page.getByRole("button", { name: "ถ่ายรูป", exact: true }).click();
  await expect(page.getByTestId("shot-review")).toBeVisible();
  await page.getByRole("button", { name: "ใช้รูปนี้" }).click();
  for (const k of liters) await page.getByRole("button", { name: k === "." ? "จุดทศนิยม" : k, exact: true }).click();
  await page.getByRole("button", { name: "บันทึกเครื่องนี้" }).click();
}

async function sign(page: Page, name: string) {
  await page.getByLabel("ชื่อผู้เซ็นรับ").fill(name);
  const box = (await page.getByTestId("signature-pad").boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 110, { steps: 6 });
  await page.mouse.move(box.x + 220, box.y + 50, { steps: 6 });
  await page.mouse.up();
  await page.getByRole("button", { name: "ยืนยันรับน้ำมัน" }).click();
}

test("a fill at the next stop: photo, liters, signature → sent, and the office sees the slip", async ({ page }) => {
  await loginDriver(page);
  await page.getByRole("link", { name: "เริ่มเติมที่จุดถัดไป" }).click();
  await expect(page.getByTestId("stop-code")).toHaveText("DEMO1");
  await page.getByRole("button", { name: "เริ่มเติมที่จุดนี้" }).click();
  await expect(page.getByRole("button", { name: "เติมครบแล้ว ไปเซ็นรับ" })).toBeDisabled();

  await addMachine(page, "PC-E2E 01", "85");
  await expect(page.getByTestId("fill-total")).toContainText("85");

  // the slip lives on the phone: a reload comes back to it, and the home offers to carry on
  await page.goto("/driver");
  await expect(page.getByRole("link", { name: "ทำต่อที่ DEMO1" })).toBeVisible();
  await expect(page.getByText("กำลังเติม 1 เครื่อง")).toBeVisible();
  await page.getByRole("link", { name: "ทำต่อที่ DEMO1" }).click();
  await addMachine(page, "PC-E2E 02", "40.5");
  await expect(page.getByTestId("fill-total")).toContainText("125.5");

  await page.getByRole("button", { name: "เติมครบแล้ว ไปเซ็นรับ" }).click();
  await expect(page.getByTestId("sign-total")).toContainText("125.5");
  await expect(page.getByRole("button", { name: "ยืนยันรับน้ำมัน" })).toBeDisabled();
  await sign(page, "สมชาย ผู้รับ");

  await expect(page).toHaveURL(/\/driver\/slip\//);
  await expect(page.getByText("ส่งแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByText("เซ็นรับแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByText("สมชาย ผู้รับ")).toBeVisible();
  const no = await page.getByTestId("slip-no").innerText();

  await page.getByRole("link", { name: "กลับหน้าหลัก" }).click();
  const route = page.getByRole("region", { name: "เส้นทางวันนี้" });
  await expect(route.getByRole("listitem").first()).toContainText("ส่งแล้ว");
  await expect(route.getByRole("listitem").first()).toContainText("125.5");
  await expect(route.locator('[aria-current="step"]')).toContainText("DEMO2");
  await expect(page.getByRole("region", { name: "น้ำมันในรถตอนนี้" })).toContainText("วันนี้เติมแล้ว 1 จาก 2 จุด");

  // the office: the slip waits in "ตรวจใบจากมือถือ" with its number
  await page.context().clearCookies();
  await login(page, "store");
  await page.goto("/check");
  await expect(page.getByText(no.split("/")[1]).first()).toBeVisible();
});

test("skip a stop with a reason, come back and fill it with nobody to sign, then get the signature later", async ({ page }) => {
  await loginDriver(page);
  await page.getByRole("link", { name: "เริ่มเติมที่จุดถัดไป" }).click();
  await expect(page.getByTestId("stop-code")).toHaveText("DEMO2");
  await page.getByRole("button", { name: "ข้ามจุดนี้" }).click();
  const sheet = page.getByRole("dialog", { name: "ข้าม DEMO2 เพราะอะไร" });
  await expect(sheet.getByRole("button", { name: "ข้ามจุดนี้" })).toBeDisabled();
  await sheet.getByLabel("หน้างานปิด หรือเข้าไม่ได้").check();
  await sheet.getByRole("button", { name: "ข้ามจุดนี้" }).click();
  await expect(page).toHaveURL("/driver");
  const row = page.getByRole("region", { name: "เส้นทางวันนี้" }).getByRole("listitem").nth(1);
  await expect(row).toContainText("ข้าม");
  await expect(row).toContainText("หน้างานปิด หรือเข้าไม่ได้");
  await expect(page.getByText("ครบทุกจุดในเส้นทางแล้ว")).toBeVisible();

  await row.getByRole("link").click();
  await expect(page.getByText("จุดนี้ถูกข้ามไปแล้ว")).toBeVisible();
  await page.getByRole("button", { name: "เริ่มเติมที่จุดนี้" }).click();
  await addMachine(page, "FL-E2E", "30");
  await page.getByRole("button", { name: "เติมครบแล้ว ไปเซ็นรับ" }).click();
  await page.getByRole("button", { name: "ไม่มีผู้เซ็นรับ" }).click();
  const why = page.getByRole("dialog", { name: "ไม่มีผู้เซ็นรับ เพราะอะไร" });
  await why.getByLabel("ผู้รับไม่สะดวกเซ็นตอนนี้").check();
  await why.getByRole("button", { name: "บันทึกแบบยังไม่เซ็นรับ" }).click();

  await expect(page).toHaveURL(/\/driver\/slip\//);
  await expect(page.getByText("ยังไม่เซ็นรับ", { exact: true })).toBeVisible();
  await expect(page.getByText("ผู้รับไม่สะดวกเซ็นตอนนี้")).toBeVisible();
  await page.getByRole("button", { name: "ขอลายเซ็นรับ" }).click();
  await sign(page, "วิไล โฟร์แมน");
  await expect(page.getByText("เซ็นรับแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByText("วิไล โฟร์แมน")).toBeVisible();
});

test("fuel bought into the truck: liters, amount and a bill photo → waits for the admin to confirm", async ({ page }) => {
  await loginDriver(page);
  const inTruck = async () => Number((await page.getByTestId("driver-tank").innerText()).replace(/,/g, ""));
  const before = await inTruck();
  await page.getByRole("link", { name: "เติมน้ำมันเข้ารถ" }).click();
  await expect(page.getByRole("button", { name: "บันทึก", exact: true })).toBeDisabled();
  // OBS-29/30: only numbers with 2 decimals get in, and the form says what is still missing
  await page.getByLabel("ลิตรที่เติมเข้า").fill("10.1232a");
  await expect(page.getByLabel("ลิตรที่เติมเข้า")).toHaveValue("10.12");
  await page.getByLabel("จำนวนเงินตามบิล").fill("-500");
  await expect(page.getByLabel("จำนวนเงินตามบิล")).toHaveValue("500");
  await expect(page.getByTestId("refill-missing")).toHaveText("ยังบันทึกไม่ได้ ขาด รูปบิล");
  await page.getByLabel("ลิตรที่เติมเข้า").fill("1,900");
  await page.getByLabel("จำนวนเงินตามบิล").fill("61750");
  await page.getByRole("button", { name: "ถ่ายรูปบิล" }).click();
  await expect(page.getByRole("heading", { name: "ถ่ายรูปบิล" })).toBeVisible();
  await page.getByRole("button", { name: "ถ่ายรูป", exact: true }).click();
  await expect(page.getByAltText("รูปบิลที่ถ่ายแล้ว")).toBeVisible();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page).toHaveURL("/driver");
  await expect.poll(inTruck).toBeCloseTo(before + 1900, 1); // the liters are in the truck at once; the price waits for the admin

  await page.context().clearCookies();
  await login(page, "store");
  await page.goto("/purchases");
  await expect(page.getByText("1,900").first()).toBeVisible();
});
