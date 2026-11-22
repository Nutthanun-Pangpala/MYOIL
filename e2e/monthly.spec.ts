import { expect, test } from "@playwright/test";
import { keyIssue, login, resetData } from "./helpers";

const MONTH = "2026-02";

test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser, baseURL }) => {
  resetData();
  const page = await browser.newPage({ baseURL });
  await login(page, "store");
  await keyIssue(page, { book: "4", doc: "1", date: "2026-02-10", project: "DEMO1", machine: "L-A", liters: "400" });
  await keyIssue(page, { book: "4", doc: "2", date: "2026-02-11", project: "DEMO1", machine: "L-B", liters: "1000" });
  await keyIssue(page, { book: "4", doc: "3", date: "2026-02-10", project: "DEMO2", machine: "L-A", liters: "50" });
  await page.close();
});

test("all projects: liters per day, per project and in total", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/monthly?month=${MONTH}`);
  const demo1 = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "DEMO1" }) });
  await expect(demo1.locator("td").nth(9)).toHaveText("400"); // day 10
  await expect(demo1.locator("td").last()).toHaveText("1,400");
  const foot = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "รวมต่อวัน" }) });
  await expect(foot.locator("td").nth(9)).toHaveText("450");
  await expect(foot.locator("td").last()).toHaveText("1,450");
});

test("one project: machines as rows", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/monthly?month=${MONTH}`);
  await page.getByRole("link", { name: "หนึ่งโครงการ" }).click();
  await expect(page.getByRole("rowheader", { name: "L-A" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "L-B" })).toBeVisible();
  const foot = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "รวมต่อวัน" }) });
  await expect(foot.locator("td").last()).toHaveText("1,400");
});

test("a number links to that day's slips of the project", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/monthly?month=${MONTH}`);
  await page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "DEMO2" }) }).getByRole("link", { name: /ใบจ่ายวันที่ 2026-02-10/ }).click();
  await expect(page).toHaveURL(/\/issues\?from=2026-02-10&to=2026-02-10&project=/);
});

test("the Excel file has the same total", async ({ page }) => {
  await login(page, "store");
  const res = await page.request.get(`/monthly/export?month=${MONTH}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("spreadsheetml");
});

test("the monthly total equals the ledger's issued total", async ({ page }) => {
  await login(page, "store");
  await page.goto(`/monthly?month=${MONTH}`);
  const total = await page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "รวมต่อวัน" }) }).locator("td").last().innerText();
  await page.goto(`/ledger?month=${MONTH}`);
  await expect(page.getByText("จ่ายออกรวม").locator("..")).toContainText(`${total}.00`);
});
