import { expect, test } from "@playwright/test";
import { login, resetData } from "./helpers";

test.beforeAll(resetData);

test("store admin signs in, sees the menu, and signs out", async ({ page }) => {
  await login(page, "store");
  for (const name of ["ใบจ่ายน้ำมัน", "ซื้อน้ำมันเข้า", "สมุดคงเหลือ"]) {
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /ในรถตอนนี้/ })).toBeVisible();
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("a wrong password is refused with a message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill("store@myoil.local");
  await page.getByLabel("รหัสผ่าน").fill("not-the-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("a visitor who is not signed in is sent to the login page", async ({ page }) => {
  await page.goto("/ledger");
  await expect(page).toHaveURL(/\/login/);
});

test("executive is read-only: no purchase menu, no record buttons", async ({ page }) => {
  await login(page, "exec");
  await expect(page.getByRole("link", { name: "ซื้อน้ำมันเข้า" })).toHaveCount(0);
  await page.goto("/purchases");
  await expect(page.getByRole("link", { name: "บันทึกการซื้อ" })).toHaveCount(0);
  await page.goto("/issues");
  await expect(page.getByRole("link", { name: "บันทึกใบจ่าย" })).toHaveCount(0);
});

test("project viewer cannot open the balance book and sees no stock", async ({ page }) => {
  await login(page, "viewer");
  await expect(page.getByRole("link", { name: /ในรถตอนนี้/ })).toHaveCount(0);
  await page.goto("/ledger");
  await expect(page).toHaveURL("/");
});

test("menu becomes an icon rail on a tablet and a top bar on a phone", async ({ page }) => {
  await login(page, "store");
  await page.setViewportSize({ width: 900, height: 800 });
  await expect(page.locator("aside")).toHaveCSS("width", "72px");
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.locator("aside")).toBeHidden();
  await page.getByText("เมนู", { exact: true }).click();
  await expect(page.getByRole("link", { name: "สมุดคงเหลือ", exact: true })).toBeVisible();
});
