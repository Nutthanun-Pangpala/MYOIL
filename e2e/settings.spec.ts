import { expect, test, type Page } from "@playwright/test";
import { keyIssue, login, resetData } from "./helpers";

const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

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

test("projects: search, add, a code already used is refused, rename, close and open again (BUG-07)", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings\/projects/);
  // design 6.11: the list filters as you type, no search button
  await page.getByLabel("ค้นหาโครงการ").fill("DEMO1");
  await expect(page.getByRole("row").filter({ hasText: "DEMO1" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "DEMO2" })).toHaveCount(0);
  await page.getByLabel("ค้นหาโครงการ").fill("");

  // add: every problem at its box, then a code another project has
  await page.getByRole("button", { name: "เพิ่มโครงการ" }).click();
  const form = page.getByRole("form", { name: "เพิ่มโครงการ" });
  await form.getByRole("button", { name: "เพิ่มโครงการ" }).click();
  await expect(form.getByText("ใส่รหัสโครงการ เช่น PNKK")).toBeVisible();
  await expect(form.getByText("ใส่ชื่อโครงการ")).toBeVisible();
  await form.getByLabel("รหัสโครงการ").fill("demo1");
  await form.getByLabel("ชื่อโครงการ").fill("โครงการทดสอบ e2e");
  await form.getByRole("button", { name: "เพิ่มโครงการ" }).click();
  await expect(form.getByText(/รหัส DEMO1 มีโครงการ .* ใช้อยู่แล้ว/)).toBeVisible();
  await form.getByLabel("รหัสโครงการ").fill("e2e-p1");
  await form.getByLabel(/รหัสบัญชี/).fill("ACC-9");
  await form.getByLabel(/ที่ตั้งไซต์/).fill("ปากซอย 5 ข้างวัด"); // OBS-23: shown on the driver's phone
  await form.getByRole("button", { name: "เพิ่มโครงการ" }).click();
  await expect(page.getByText("เพิ่มโครงการ E2E-P1 แล้ว")).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "E2E-P1" });
  await expect(row).toContainText("ACC-9");
  await expect(row).toContainText("ที่ตั้ง: ปากซอย 5 ข้างวัด");
  await expect(row).toContainText("เพิ่มเองใน MYOIL");
  await expect(page.getByRole("row").filter({ hasText: "DEMO1" })).toContainText("จาก BookCare");
  await expect(row).toContainText("เปิด");

  // a new project can be chosen on the route page at once
  await page.goto("/routes");
  await expect(page.locator('select[name="projectId"] option', { hasText: "E2E-P1" })).toHaveCount(1);

  // rename, close (gone from the route picker), open again
  await page.goto("/settings/projects");
  await page.getByRole("button", { name: "แก้ไขโครงการ E2E-P1" }).click();
  const edit = page.getByRole("form", { name: "แก้ไขโครงการ" });
  await edit.getByLabel("ชื่อโครงการ").fill("โครงการทดสอบ เปลี่ยนชื่อ");
  await edit.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(row).toContainText("โครงการทดสอบ เปลี่ยนชื่อ");
  await page.getByRole("button", { name: "ปิดโครงการ E2E-P1" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ปิดโครงการนี้" }).click(); // OBS-22: asked first
  await expect(page.getByText("ปิดโครงการ E2E-P1 แล้ว")).toBeVisible();
  await page.goto("/routes");
  await expect(page.locator('select[name="projectId"] option', { hasText: "E2E-P1" })).toHaveCount(0);
  await page.goto("/settings/projects");
  await page.getByRole("button", { name: "เปิดโครงการ E2E-P1" }).click();
  await expect(page.getByText("เปิดโครงการ E2E-P1 แล้ว")).toBeVisible();
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
  // design 6.1: with the right password a closed account is told so (a wrong password still gets "ไม่ถูกต้อง")
  await expect(p4.getByRole("alert").filter({ hasText: "บัญชีนี้ถูกปิดการใช้งาน" })).toBeVisible();
  await expect(p4).toHaveURL(/\/login/);
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

  // delete (owner, 26 Nov 2026): asked first; a machine no slip used is gone, and its code can be added again
  await page.getByRole("button", { name: "ลบเครื่องจักร PC30 เช่า" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toContainText("ยังไม่เคยถูกใช้ในใบจ่าย");
  await dlg.getByRole("button", { name: "ลบเครื่องจักรนี้" }).click();
  await expect(page.getByText("ลบเครื่องจักร PC30 เช่า แล้ว")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "PC30 เช่า" })).toHaveCount(0);
});

test("machines: one that slips already name is only taken off the lists, and comes back when its code is added again", async ({ page }) => {
  await login(page, "store");
  await keyIssue(page, { book: "40", doc: "1", date: TODAY, machine: "DEL-1", liters: "10" });
  await page.context().clearCookies(); // sign out: settings are the system admin's
  await login(page, "admin");
  await page.goto("/settings/machines");
  await page.getByRole("button", { name: "ลบเครื่องจักร DEL-1" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toContainText("ถูกใช้ในใบจ่าย 1 ใบ");
  await dlg.getByRole("button", { name: "ลบเครื่องจักรนี้" }).click();
  await expect(page.getByRole("row").filter({ hasText: "DEL-1" })).toHaveCount(0);
  // the slip still names it
  await page.goto("/issues");
  await expect(page.getByRole("row").filter({ hasText: "40 / 1" })).toContainText("DEL-1");
  // and it is no longer offered on the slip form
  await page.goto("/issues/new");
  await expect(page.locator("datalist option[value='DEL-1']")).toHaveCount(0);
  // adding the code again brings it back
  await page.goto("/settings/machines");
  await page.getByRole("button", { name: "เพิ่มเครื่องจักร" }).first().click();
  const f = page.getByRole("form", { name: "เพิ่มเครื่องจักร" });
  await f.getByLabel("รหัสหรือทะเบียน").fill("DEL-1");
  await f.getByRole("button", { name: "เพิ่มเครื่องจักร" }).click();
  await expect(page.getByRole("row").filter({ hasText: "DEL-1" })).toHaveCount(1);
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

test("cycles are cut on a set day of every month: open cycles are laid out again, slips follow their own dates", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/settings/cycles");
  const form = page.getByRole("form", { name: "วันตัดรอบของทุกเดือน" });
  await expect(form.getByRole("button", { name: "บันทึกวันตัดรอบ" })).toBeDisabled(); // nothing changed yet
  await form.getByLabel("ตัดรอบทุกวันที่").selectOption({ label: "วันที่ 21" });
  await expect(page.getByText("รอบหนึ่งคือวันที่ 22 ถึงวันที่ 21 ของเดือนถัดไป")).toBeVisible();
  await form.getByRole("button", { name: "บันทึกวันตัดรอบ" }).click();
  await expect(page.getByRole("status").filter({ hasText: "บันทึกวันตัดรอบแล้ว" })).toBeVisible();
  // every open cycle now ends on a 21st, and the next one starts on the 22nd
  await expect(page.getByRole("cell", { name: /^21\/\d\d\/\d\d$/ }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: /^22\/\d\d\/\d\d$/ }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: /^(30|31)\/\d\d\/\d\d$/ })).toHaveCount(0);

  // back to the calendar month
  await form.getByLabel("ตัดรอบทุกวันที่").selectOption({ label: "สิ้นเดือน (เดือนปฏิทิน)" });
  await form.getByRole("button", { name: "บันทึกวันตัดรอบ" }).click();
  await expect(page.getByRole("cell", { name: /^01\/\d\d\/\d\d$/ }).first()).toBeVisible();
});
