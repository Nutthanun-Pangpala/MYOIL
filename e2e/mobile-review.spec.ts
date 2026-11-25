import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { TEST_PUSH_KEY } from "../playwright.config";
import { login, planStop, resetData } from "./helpers";

/** a slip sent from the phone is checked by the office before it can be invoiced (stage 2) */
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const jpeg = (seed: string) => {
  const data = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(seed)]);
  return { mime: "image/jpeg", sha256: createHash("sha256").update(data).digest("hex"), takenAt: null, data: data.toString("base64") };
};

test.describe.configure({ mode: "serial" });
test.beforeAll(() => resetData());

test("check a phone slip: held machine name first, then ตรวจแล้ว; the cycle page warns before closing", async ({ page, request }) => {
  const ref = randomUUID();
  const res = await request.post("/api/bookcare/v1/issues", {
    headers: { Authorization: `Bearer ${TEST_PUSH_KEY}` },
    data: {
      ref,
      routeStopId: planStop(today, "DEMO1"),
      projectRefCode: "DEMO1",
      issueDate: today,
      recordedAt: null,
      driver: { bookcareUserId: "bc-1", name: "สมชาย" },
      vehicleCode: null,
      lines: [{ position: 1, machineId: null, machineCode: "พีซี 210", liters: "80", hourMeter: null, photo: jpeg("meter") }],
      signature: { receiverName: "สมศรี", signedAt: `${today}T10:00:00+07:00`, image: jpeg("sign") },
      unsignedReason: null,
      confirmedWarnings: [],
    },
  });
  expect(res.status()).toBe(201);
  // API 1 answers `issueId` (contract §3)
  const { issueId: id } = await res.json();

  await login(page, "store");
  await page.goto("/issues?review=pending");
  // the slip's row shows the status; "รอตรวจ" is also in the side menu (hidden text next to the count) and in the status dropdown
  await expect(page.getByRole("row").filter({ hasText: "รอตรวจ" }).first()).toBeVisible();

  // the cycle page says what closing now would do
  await page.goto("/invoices");
  await expect(page.getByText("ใบจากมือถือที่เซ็นรับแล้วแต่ยังไม่ได้ตรวจ 1 ใบ")).toBeVisible();

  await page.goto(`/issues/${id}`);
  await expect(page.getByRole("heading", { name: "ตรวจใบจากมือถือ" })).toBeVisible();
  await expect(page.getByAltText("รูปมิเตอร์ บรรทัด 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "ตรวจแล้ว" })).toBeDisabled(); // the typed machine name is still held

  await page.getByRole("button", { name: "รับเป็นเครื่องใหม่" }).click();
  await expect(page.getByRole("button", { name: "ตรวจแล้ว" })).toBeEnabled();
  await page.getByRole("button", { name: "ตรวจแล้ว" }).click();
  await expect(page.getByText(/ตรวจโดย/)).toBeVisible();

  await page.goto("/invoices");
  await expect(page.getByText("ใบจากมือถือที่เซ็นรับแล้วแต่ยังไม่ได้ตรวจ")).toHaveCount(0);
});

test("editing a checked phone slip keeps its meter photo and marks it 'แก้หลังเซ็นรับ'", async ({ page, request }) => {
  const ref = randomUUID();
  const res = await request.post("/api/bookcare/v1/issues", {
    headers: { Authorization: `Bearer ${TEST_PUSH_KEY}` },
    data: {
      ref,
      routeStopId: planStop(today, "DEMO1"),
      projectRefCode: "DEMO1",
      issueDate: today,
      recordedAt: null,
      driver: { bookcareUserId: "bc-1", name: "สมชาย" },
      vehicleCode: null,
      lines: [{ position: 1, machineId: null, machineCode: "FL022", liters: "60", hourMeter: null, photo: jpeg("meter-2") }],
      signature: { receiverName: "สมศรี", signedAt: `${today}T10:00:00+07:00`, image: jpeg("sign-2") },
      unsignedReason: null,
      confirmedWarnings: [],
    },
  });
  // API 1 answers `issueId` (contract §3)
  const { issueId: id } = await res.json();
  await login(page, "store");
  await page.goto(`/issues/${id}/edit`);
  await page.getByLabel("จำนวนน้ำมัน (ลิตร)").first().fill("65");
  await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
  await expect(page).toHaveURL(new RegExp(`/issues/${id}`));
  await expect(page.getByText("แก้หลังเซ็นรับ").first()).toBeVisible();
  await expect(page.getByAltText("รูปมิเตอร์ บรรทัด 1")).toBeVisible();
});

test("a purchase from the phone is a price at once and still waits for ยืนยัน", async ({ page, request }) => {
  const res = await request.post("/api/bookcare/v1/purchases", {
    headers: { Authorization: `Bearer ${TEST_PUSH_KEY}` },
    data: { ref: randomUUID(), purchaseDate: today, recordedAt: null, driver: { bookcareUserId: "bc-1", name: "สมชาย" }, liters: "2000", amount: "64980.00", billNo: "INV-E2E", billPhoto: jpeg("bill") },
  });
  expect(res.status()).toBe(201);
  await login(page, "store");
  await page.goto("/purchases");
  await expect(page.getByText("รอยืนยัน (จากมือถือ)")).toBeVisible();
  await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(page.getByText("รอยืนยัน (จากมือถือ)")).toHaveCount(0);
  await expect(page.getByText("32.49").first()).toBeVisible(); // 64,980.00 ÷ 2,000 = 32.49 per liter
});

test("a phone slip dated after the day it reaches MYOIL is accepted but flagged for the checker (OBS-25)", async ({ page, request }) => {
  // as in test round 10: a phone whose clock runs ahead sends a slip dated later than today
  const ahead = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const res = await request.post("/api/bookcare/v1/issues", {
    headers: { Authorization: `Bearer ${TEST_PUSH_KEY}` },
    data: {
      ref: randomUUID(),
      routeStopId: planStop(ahead, "DEMO2"),
      projectRefCode: "DEMO2",
      issueDate: ahead,
      recordedAt: null,
      driver: { bookcareUserId: "bc-1", name: "สมชาย" },
      vehicleCode: null,
      lines: [{ position: 1, machineId: null, machineCode: "FL022", liters: "90", hourMeter: null, photo: jpeg("meter-ahead") }],
      signature: { receiverName: "สมศรี", signedAt: `${today}T10:00:00+07:00`, image: jpeg("sign-ahead") },
      unsignedReason: null,
      confirmedWarnings: [],
    },
  });
  expect(res.status()).toBe(201);
  const { issueId: id } = await res.json();

  await login(page, "store");
  await page.goto(`/issues/${id}`);
  await expect(page.getByRole("list", { name: "สิ่งที่ระบบจับได้" })).toContainText("นาฬิกามือถืออาจผิด");
  await page.goto("/check");
  await expect(page.getByText("ลงวันที่ล่วงหน้า").first()).toBeVisible();
});
