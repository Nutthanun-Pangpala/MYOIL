import { expect, test } from "@playwright/test";
import { login, loginDriver, planStops, pressDigits, resetData } from "./helpers";

/** the fuel-truck driver's door and home (design "MYOIL — หน้าจอฝั่ง พขร. (ขั้นที่ 2)", boards Login, LoginWrong, Main, HomeNoRoute) */
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

test.describe.configure({ mode: "serial" });
test.beforeAll(() => resetData());

test("the keypad guides the phone and the PIN; a wrong PIN clears itself, says so, and keeps the phone", async ({ page }) => {
  await page.goto("/login/driver");
  const say = page.getByTestId("login-message");
  await expect(say).toHaveText("กดตัวเลขด้านล่าง ครบ 10 หลักแล้วไปที่ PIN เอง");
  await pressDigits(page, "8");
  await expect(say).toHaveText("เบอร์มือถือขึ้นต้นด้วย 0"); // OBS-35: a wrong start never gets in
  await pressDigits(page, "081000");
  await page.getByTestId("pin-boxes").click();
  await expect(say).toHaveText("เบอร์ยังไม่ครบ (6/10 หลัก)");
  await pressDigits(page, "0002"); // the 10th digit moves on to the PIN by itself
  await expect(page.getByTestId("phone-done")).toContainText("081-000-0002");
  await expect(say).toHaveText("ใส่ PIN ครบ 6 หลัก ระบบเข้าให้เอง");

  await pressDigits(page, "11111");
  await page.getByRole("button", { name: "ลบตัวสุดท้าย" }).click();
  await pressDigits(page, "11"); // the 6th digit sends it, there is no login button
  await expect(page.getByRole("alert").filter({ hasText: "ไม่ถูกต้อง" })).toBeVisible();
  await expect(page).toHaveURL("/login/driver");
  await expect(page.getByTestId("phone-done")).toContainText("081-000-0002");
  await expect(page.getByRole("button", { name: "PIN ใส่แล้ว 0 จาก 6 หลัก" })).toBeVisible();

  await pressDigits(page, "246810"); // the right PIN straight after: in
  await expect(page).toHaveURL("/driver");
});

test("this phone is remembered: the next login is the name and the PIN only", async ({ page }) => {
  await loginDriver(page);
  await page.goto("/driver/account");
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await page.goto("/login/driver");
  await expect(page.getByRole("heading", { name: "สวัสดีครับ คุณสุชาติ" })).toBeVisible();
  await expect(page.getByTestId("phone-done")).toContainText("081-•••-0001");
  await pressDigits(page, "246810");
  await expect(page).toHaveURL("/driver");

  // someone else's turn on the same phone
  await page.goto("/driver/account");
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await page.goto("/login/driver");
  await page.getByRole("button", { name: "ไม่ใช่ฉัน ใช้เบอร์อื่น" }).click();
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
  await pressDigits(page, "0810000002246810");
  await expect(page).toHaveURL("/driver");
  await expect(page.getByText("สวัสดีครับ คุณวิชัย")).toBeVisible();
});

test("no route today: the home says so and offers to load it again", async ({ page }) => {
  await loginDriver(page);
  await expect(page.getByRole("region", { name: "น้ำมันในรถตอนนี้" })).toContainText("วันนี้ยังไม่ได้เติม");
  await expect(page.getByRole("heading", { name: "วันนี้ยังไม่มีเส้นทาง" })).toBeVisible();
  await expect(page.getByRole("link", { name: "โหลดเส้นทางอีกครั้ง" })).toBeVisible();

  // the admin plans two stops; "load again" shows them, the first one is next
  planStops(TODAY, ["DEMO1", "DEMO2"]);
  await page.getByRole("link", { name: "โหลดเส้นทางอีกครั้ง" }).click();
  const route = page.getByRole("region", { name: "เส้นทางวันนี้" });
  await expect(route.getByRole("listitem")).toHaveCount(2);
  await expect(route.locator('[aria-current="step"]')).toContainText("DEMO1");
  await expect(route.locator('[aria-current="step"]')).toContainText("จุดถัดไป");
  await expect(page.getByText("เริ่มเติมที่จุดถัดไป")).toBeVisible();
});

test("the admin adds a driver, gets a PIN once, and the driver signs in with it; a new PIN replaces the old one", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/settings/users");
  const card = page.getByRole("region", { name: "คนขับรถเติมน้ำมัน" });
  await card.getByRole("button", { name: "เพิ่มคนขับ" }).click();
  const form = page.getByRole("form", { name: "เพิ่มคนขับ" });

  // a phone already in use is refused at its box, and the name stays
  await form.getByLabel("ชื่อ นามสกุล").fill("สมหมาย ทดสอบ");
  await form.getByLabel("เบอร์มือถือ").fill("081-000-0001");
  await form.getByRole("button", { name: "เพิ่มคนขับ" }).click();
  await expect(form.getByRole("alert")).toContainText("เบอร์นี้เป็นของ");
  await expect(form.getByLabel("ชื่อ นามสกุล")).toHaveValue("สมหมาย ทดสอบ");

  await form.getByLabel("เบอร์มือถือ").fill("089-555-0142");
  await form.getByRole("button", { name: "เพิ่มคนขับ" }).click();
  const pin = (await page.getByTestId("driver-pin").innerText()).trim();
  expect(pin).toMatch(/^\d{6}$/);
  await page.getByRole("button", { name: "จดแล้ว ปิด" }).click();
  await expect(card.getByRole("row").filter({ hasText: "สมหมาย ทดสอบ" })).toContainText("089-555-0142");

  // a new PIN: the first one stops working
  await card.getByRole("row").filter({ hasText: "สมหมาย ทดสอบ" }).getByRole("button", { name: "ตั้ง PIN ใหม่" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ตั้ง PIN ใหม่" }).click();
  const pin2 = (await page.getByTestId("driver-pin").innerText()).trim();
  await page.getByRole("button", { name: "จดแล้ว ปิด" }).click();

  await page.context().clearCookies();
  await page.goto("/login/driver");
  await pressDigits(page, "0895550142");
  if (pin !== pin2) {
    await pressDigits(page, pin);
    await expect(page.getByRole("alert").filter({ hasText: "ไม่ถูกต้อง" })).toBeVisible();
  }
  await pressDigits(page, pin2);
  await expect(page).toHaveURL("/driver");
  await expect(page.getByText("สวัสดีครับ คุณสมหมาย")).toBeVisible();
});
