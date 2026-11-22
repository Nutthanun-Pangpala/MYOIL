import { expect, test, type Page } from "@playwright/test";
import { login, resetData } from "./helpers";

test.describe.configure({ mode: "serial" });
test.beforeAll(resetData);

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
}

test("only the system admin opens settings; others see a clear no-access page", async ({ page }) => {
  await login(page, "store");
  await page.goto("/settings/users");
  await expect(page.getByRole("heading", { name: "ไม่มีสิทธิ์เข้าหน้านี้" })).toBeVisible();
  await expect(page.getByRole("button", { name: "เพิ่มผู้ใช้" })).toHaveCount(0);
});

test("projects are read-only and searchable", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings\/projects/);
  await page.getByLabel("ค้นหาโครงการ").fill("DEMO1");
  await page.getByRole("button", { name: "ค้นหา" }).click();
  await expect(page.getByRole("row").filter({ hasText: "DEMO1" })).toBeVisible();
  await expect(page.getByRole("button", { name: /เพิ่ม|แก้ไข/ })).toHaveCount(0);
});

test("users: every problem shows at once, then create, sign in, reset password, deactivate", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/settings/users");
  await page.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
  const form = page.getByRole("form", { name: "เพิ่มผู้ใช้" });
  await form.getByLabel(/^อีเมล/).fill("nope");
  await form.getByLabel("รหัสผ่านเริ่มต้น").fill("123");
  await form.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
  await expect(form.getByText("แก้ 4 จุดที่ขึ้นสีแดงก่อน")).toBeVisible(); // name, email, projects, password

  await form.getByLabel(/^ชื่อ/).fill("ทดสอบ หนึ่ง");
  await form.getByLabel(/^อีเมล/).fill("t1@myoil.local");
  await form.getByLabel("ค้นหาโครงการ").fill("DEMO1");
  await form.getByRole("checkbox").first().check();
  await form.getByLabel("รหัสผ่านเริ่มต้น").fill("firstpass1");
  await form.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
  await expect(page.getByRole("status")).toContainText("เพิ่มผู้ใช้แล้ว");
  const row = page.getByRole("row").filter({ hasText: "t1@myoil.local" });
  await expect(row).toContainText("DEMO1");

  // the same email again is refused at the field
  await page.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
  const again = page.getByRole("form", { name: "เพิ่มผู้ใช้" });
  await again.getByLabel(/^ชื่อ/).fill("ซ้ำ");
  await again.getByLabel(/^อีเมล/).fill("t1@myoil.local");
  await again.getByRole("checkbox").first().check();
  await again.getByLabel("รหัสผ่านเริ่มต้น").fill("secondpass");
  await again.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
  await expect(again.getByText("อีเมลนี้มีผู้ใช้อยู่แล้ว")).toBeVisible();

  // the new user signs in
  const other = await page.context().browser()!.newContext();
  const p2 = await other.newPage();
  await loginAs(p2, "t1@myoil.local", "firstpass1");
  await expect(p2).toHaveURL(/\/(\?.*)?$/);

  // reset password: old one stops working, new one works
  await row.getByRole("button", { name: "รีเซ็ตรหัสผ่าน" }).click();
  const reset = page.getByRole("region", { name: "รีเซ็ตรหัสผ่าน" });
  await reset.getByLabel("รหัสผ่านใหม่").fill("short");
  await reset.getByRole("button", { name: "รีเซ็ตรหัสผ่าน" }).click();
  await expect(reset.getByText("อย่างน้อย 8")).toBeVisible();
  await reset.getByLabel("รหัสผ่านใหม่").fill("secondpass2");
  await reset.getByRole("button", { name: "รีเซ็ตรหัสผ่าน" }).click();
  await expect(page.getByRole("status")).toContainText("รีเซ็ตรหัสผ่านของ ทดสอบ หนึ่ง แล้ว");
  const p3 = await (await page.context().browser()!.newContext()).newPage();
  await loginAs(p3, "t1@myoil.local", "firstpass1");
  await expect(p3.getByRole("alert").filter({ hasText: "ไม่ถูกต้อง" })).toBeVisible();
  await loginAs(p3, "t1@myoil.local", "secondpass2");
  await expect(p3).toHaveURL(/\/(\?.*)?$/);

  // deactivate asks first, then the user can't sign in
  await row.getByRole("button", { name: "ปิดบัญชี" }).click();
  await expect(page.getByText("ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้ทันที")).toBeVisible();
  await page.getByRole("region", { name: "ปิดบัญชี" }).getByRole("button", { name: "ปิดบัญชี" }).click();
  await expect(row).toContainText("ปิดบัญชีแล้ว");
  const p4 = await (await page.context().browser()!.newContext()).newPage();
  await loginAs(p4, "t1@myoil.local", "secondpass2");
  await expect(p4.getByRole("alert").filter({ hasText: "ไม่ถูกต้อง" })).toBeVisible();
});

test("the admin cannot close their own account or the last admin", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/settings/users");
  const me = page.getByRole("row").filter({ hasText: "admin@myoil.local" });
  await expect(me.getByRole("button", { name: "ปิดบัญชี" })).toHaveCount(0);
});

test("machines: add, duplicate refused, rented has no asset code", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/settings/machines");
  await page.getByRole("button", { name: "เพิ่มเครื่องจักร" }).first().click();
  const f = page.getByRole("form", { name: "เพิ่มเครื่องจักร" });
  await f.getByLabel("รหัสหรือทะเบียน").fill("PC210");
  await f.getByLabel("ชื่อ (ไม่บังคับ)").fill("รถขุดล้อโซ่");
  await f.getByLabel("รหัสทรัพย์สิน (ไม่บังคับ)").fill("A-1");
  await f.getByRole("button", { name: "เพิ่มเครื่องจักร" }).click();
  const row = page.getByRole("row").filter({ hasText: "PC210" });
  await expect(row).toContainText("A-1");

  await page.getByRole("button", { name: "เพิ่มเครื่องจักร" }).first().click();
  const g = page.getByRole("form", { name: "เพิ่มเครื่องจักร" });
  await g.getByLabel("รหัสหรือทะเบียน").fill(" pc210 ");
  await g.getByRole("button", { name: "เพิ่มเครื่องจักร" }).click();
  await expect(g.getByRole("alert")).toContainText("มีเครื่องจักร “PC210” อยู่แล้ว");

  await g.getByLabel("รหัสหรือทะเบียน").fill("PC30 เช่า");
  await g.getByRole("radio", { name: /^เช่า/ }).check();
  await expect(g.getByLabel("รหัสทรัพย์สิน (ไม่บังคับ)")).toHaveCount(0);
  await g.getByRole("button", { name: "เพิ่มเครื่องจักร" }).click();
  await expect(page.getByRole("row").filter({ hasText: "PC30 เช่า" })).toContainText("เช่า");
});

test("tank: bad numbers are said at the field, good ones save", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/settings/tank");
  const f = page.getByRole("form", { name: "แก้ค่าของรถเติมน้ำมัน" });
  await f.getByLabel("ความจุถัง (ลิตร)").fill("1000");
  await f.getByLabel("เตือนใกล้หมดเมื่อเหลือต่ำกว่า (ลิตร)").fill("2000");
  await f.getByRole("button", { name: "บันทึก" }).click();
  await expect(f.getByText("ค่าเตือนต้องไม่เกินความจุถัง")).toBeVisible();
  await f.getByLabel("เตือนใกล้หมดเมื่อเหลือต่ำกว่า (ลิตร)").fill("250");
  await f.getByRole("button", { name: "บันทึก" }).click();
  await expect(f.getByRole("status")).toContainText("บันทึกค่าของรถเติมน้ำมันแล้ว");
  await page.reload();
  await expect(page.getByText("ความจุถัง 1,000 ลิตร")).toBeVisible();
});

test("cycles: the next cycle is already listed and its end date can change", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/settings/cycles");
  await expect(page.getByText("ยังไม่เริ่ม สร้างอัตโนมัติ")).toBeVisible();
  const future = page.getByRole("row").filter({ hasText: "ยังไม่เริ่ม" });
  await future.getByRole("button", { name: "แก้ไข" }).click();
  const f = page.getByRole("form", { name: "แก้วันที่ของรอบ" });
  const start = await f.getByLabel("วันเริ่ม").inputValue();
  await f.getByLabel("วันสิ้นสุด", { exact: true }).fill(start.slice(0, 8) + "20");
  await f.getByRole("button", { name: "บันทึกวันที่" }).click();
  await expect(page.getByRole("status")).toContainText("บันทึกวันที่ของรอบแล้ว");
  await expect(future).toContainText("20/");
});
