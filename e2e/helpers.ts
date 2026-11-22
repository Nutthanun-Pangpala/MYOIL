import { execSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "myoil1234";
export const USERS = {
  store: "store@myoil.local",
  viewer: "viewer@myoil.local",
  exec: "exec@myoil.local",
  admin: "admin@myoil.local",
} as const;

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
  await expect(page).toHaveURL(/\/issues\/[0-9a-f-]{36}/);
}

/** record a purchase in the side panel of /purchases (liters + price are enough, the amount fills itself) */
export async function recordPurchase(page: Page, p: { date: string; liters: string; price: string; billNo?: string }) {
  await page.goto(`/purchases?month=${p.date.slice(0, 7)}&new=purchase`);
  const form = page.getByRole("form", { name: "บันทึกการซื้อ" });
  await form.getByLabel("วันที่").fill(p.date);
  await form.getByLabel("เติมเข้า (ลิตร)").fill(p.liters);
  await form.getByLabel("ราคาต่อลิตร (บาท)").fill(p.price);
  if (p.billNo) await form.getByLabel(/เลขที่บิล/).fill(p.billNo);
  await form.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/purchases\\?month=${p.date.slice(0, 7)}$`));
}
