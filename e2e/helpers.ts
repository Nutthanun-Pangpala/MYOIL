import { execSync } from "node:child_process";
import { expect, type Locator, type Page } from "@playwright/test";

export const PASSWORD = "myoil1234";
export const USERS = {
  store: "store@myoil.local",
  viewer: "viewer@myoil.local",
  exec: "exec@myoil.local",
  admin: "admin@myoil.local",
} as const;

// 1×1 PNG: the browser really decodes it, then re-encodes it as a small JPEG
const TINY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** a new purchase bill always carries its photo (owner, 26 Nov 2026): attach one to the open "บันทึกการซื้อ" form */
export async function attachBill(form: Locator) {
  await form.getByLabel(/รูปบิล/).setInputFiles({ name: "bill.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(form.getByText("แนบแล้ว: bill.png")).toBeVisible();
}

/** same starting point for every spec file: demo accounts, no fuel records */
export function resetData() {
  execSync("npm run db:seed", { stdio: "ignore" });
}

export async function login(page: Page, who: keyof typeof USERS) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(USERS[who]);
  await page.getByLabel("รหัสผ่าน").fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL("/");
}

/** key one fuel slip through the real form and save it with "บันทึก" */
export async function keyIssue(
  page: Page,
  s: { book: string; doc: string; date: string; project?: string; machine: string; liters: string },
) {
  await page.goto("/issues/new");
  await page.getByLabel("เล่มที่").fill(s.book);
  await page.getByLabel("เลขที่", { exact: true }).fill(s.doc);
  await page.getByLabel(/^วันที่/).fill(s.date);
  await page.getByLabel("โครงการ").fill(s.project ?? "DEMO1");
  await page.getByLabel("รายการหรือรหัสเครื่องจักร").first().fill(s.machine);
  await page.getByLabel("จำนวนน้ำมัน (ลิตร)").first().fill(s.liters);
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  // a slip that moves the money of later slips (oldest fuel first) is asked about first: say yes
  const yes = page.getByRole("button", { name: "ยืนยันบันทึก" });
  const saved = /\/issues\/[0-9a-f-]{36}/;
  await expect(async () => expect(saved.test(page.url()) || (await yes.count()) > 0).toBe(true)).toPass();
  if (!saved.test(page.url())) await yes.click();
  await expect(page).toHaveURL(saved);
}

/** record a purchase in the side panel of /purchases (liters + price are enough, the amount fills itself) */
export async function recordPurchase(page: Page, p: { date: string; liters: string; price: string; billNo?: string }) {
  await page.goto(`/purchases?month=${p.date.slice(0, 7)}&new=purchase`);
  const form = page.getByRole("form", { name: "บันทึกการซื้อ" });
  await form.getByLabel("วันที่").fill(p.date);
  await form.getByLabel("เติมเข้า (ลิตร)").fill(p.liters);
  await form.getByLabel("ราคาต่อลิตร (บาท)").fill(p.price);
  if (p.billNo) await form.getByLabel(/เลขที่บิล/).fill(p.billNo);
  await attachBill(form);
  await form.getByRole("button", { name: "บันทึก", exact: true }).click();
  // a bill that would change the money of slips already priced asks first ("ยืนยันบันทึก", brief §14 B5);
  // one that prices or reprices open slips says so and waits for "รับทราบ"; otherwise the form closes by itself
  const month = new RegExp(`/purchases\\?month=${p.date.slice(0, 7)}$`);
  const note = form.getByRole("status");
  const yes = form.getByRole("button", { name: "ยืนยันบันทึก" });
  const settled = async () => (await note.count()) > 0 || month.test(page.url());
  await expect(async () => expect((await settled()) || (await yes.count()) > 0).toBe(true)).toPass();
  if (!(await settled())) {
    await yes.click();
    await expect(async () => expect(await settled()).toBe(true)).toPass();
  }
  if (!month.test(page.url())) await form.getByRole("button", { name: "รับทราบ" }).click();
  await expect(page).toHaveURL(month);
}

/** plan route stops for a day straight in the local DB (scripts/e2e-plan-route.ts); returns their ids in order */
export function planStops(date: string, codes: string[]): string[] {
  const out = execSync(`npx tsx --env-file=.env scripts/e2e-plan-route.ts ${date} ${codes.join(" ")}`, { encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").pop()!) as string[];
}

/** one fresh stop: every phone slip needs its own stop of the route (contract §9.1, 1 stop = 1 slip) */
export const planStop = (date: string, code: string) => planStops(date, [code])[0];

/** press digits on the driver login's big keypad (phone, then PIN: no keyboard, no login button) */
export async function pressDigits(page: Page, digits: string) {
  for (const d of digits) await page.getByRole("button", { name: d, exact: true }).click();
}

/** the driver's login: 10 digits of the phone, 6 of the PIN, and the 6th one logs in by itself */
export async function loginDriver(page: Page, phone = "0810000001", pin = "246810") {
  await page.goto("/login/driver");
  await pressDigits(page, phone);
  await pressDigits(page, pin);
  await expect(page).toHaveURL("/driver");
}
