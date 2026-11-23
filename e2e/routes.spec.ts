import { createHash, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { TEST_PUSH_KEY } from "../playwright.config";
import { login, resetData } from "./helpers";

/** วางเส้นทางรถเติมน้ำมัน (brief §8, R20–R23): the admin plans 3 stops, the phone (via the API) fills one and skips one */
const DAY = "2026-11-27";
const auth = { Authorization: `Bearer ${TEST_PUSH_KEY}` };
const jpeg = (seed: string) => {
  const data = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(seed)]);
  return { mime: "image/jpeg", sha256: createHash("sha256").update(data).digest("hex"), takenAt: null, data: data.toString("base64") };
};

test.describe.configure({ mode: "serial" });
test.beforeAll(() => resetData());

async function addStop(page: Page, label: string, note = "") {
  const form = page.getByRole("form", { name: "เพิ่มจุดเติม" });
  await form.getByLabel("โครงการ").selectOption({ label });
  if (note) await form.getByLabel(/หมายเหตุถึง พขร./).fill(note);
  await form.getByRole("button", { name: "เพิ่มจุดเติม" }).click();
  await expect(page.getByRole("status")).toHaveText("เพิ่มจุดแล้ว");
}

test("the admin plans 3 stops; the phone's API sees them in order; a fill and a skip come back as statuses", async ({ page, request }) => {
  await login(page, "store");
  await page.goto(`/routes?date=${DAY}`);
  await expect(page.getByText("ยังไม่มีเส้นทางของวันนี้")).toBeVisible();
  await addStop(page, "DEMO1 · ตัวอย่าง 1", "เติม PC210 ก่อน 9 โมง");
  await addStop(page, "DEMO2 · ตัวอย่าง 2");
  await addStop(page, "DEMO2 · ตัวอย่าง 2", "รอบบ่าย");
  // the 3rd goes first. Wait for each move to show before the next click: every button belongs to the page it was drawn on
  await page.getByRole("button", { name: "เลื่อนจุดที่ 3 ขึ้น" }).click();
  await expect(page.getByLabel("หมายเหตุจุดที่ 2")).toHaveValue("รอบบ่าย");
  await page.getByRole("button", { name: "เลื่อนจุดที่ 2 ขึ้น" }).click();
  await expect(page.getByLabel("หมายเหตุจุดที่ 1")).toHaveValue("รอบบ่าย");
  const rows = page.getByTestId("route-stop");
  await expect(rows).toHaveCount(3);

  const route = await (await request.get(`/api/bookcare/v1/route?date=${DAY}`, { headers: auth })).json();
  expect(route.stops.map((s: { projectRefCode: string; position: number }) => `${s.position}:${s.projectRefCode}`)).toEqual(["1:DEMO2", "2:DEMO1", "3:DEMO2"]);
  expect(route.stops.map((s: { note: string | null }) => s.note)).toEqual(["รอบบ่าย", "เติม PC210 ก่อน 9 โมง", null]);
  const [first, second] = route.stops;

  // the phone fills stop 1 and skips stop 2
  const fill = await request.post("/api/bookcare/v1/issues", {
    headers: auth,
    data: {
      ref: randomUUID(),
      routeStopId: first.id,
      projectRefCode: "DEMO2",
      issueDate: DAY,
      timeIn: "08:10",
      timeOut: "08:25",
      recordedAt: `${DAY}T08:25:00+07:00`,
      driver: { bookcareUserId: "bc-1", name: "สมชาย" },
      vehicleCode: null,
      lines: [{ position: 1, machineId: null, machineCode: "PC210", liters: "90", hourMeter: null, photo: jpeg("r-meter") }],
      signature: { receiverName: "สมศรี", signedAt: `${DAY}T08:25:00+07:00`, image: jpeg("r-sign") },
      unsignedReason: null,
      confirmedWarnings: [],
    },
  });
  expect(fill.status()).toBe(201);
  const skip = await request.post(`/api/bookcare/v1/route/stops/${second.id}/skip`, {
    headers: auth,
    data: { skipRef: randomUUID(), reason: "หน้างานไม่ต้องการน้ำมันวันนี้", skippedAt: `${DAY}T09:40:00+07:00`, driver: { bookcareUserId: "bc-1", name: "สมชาย" } },
  });
  expect(skip.status()).toBe(200);

  await page.reload();
  await expect(rows.nth(0)).toContainText("เติมแล้ว");
  await expect(rows.nth(0).getByRole("link", { name: /ใบ M\d{4}\/\d{4}/ })).toBeVisible();
  await expect(rows.nth(0)).toContainText("เติมแล้ว แก้ไม่ได้");
  await expect(rows.nth(1)).toContainText("ข้าม");
  await expect(rows.nth(1)).toContainText("หน้างานไม่ต้องการน้ำมันวันนี้");
  await expect(rows.nth(1)).toContainText("สมชาย");
  await expect(rows.nth(2)).toContainText("ยังไม่ไป");
  await expect(page.getByTestId("route-counts")).toHaveText("3 จุด · ยังไม่ไป 1 · เติมแล้ว 1 · ข้าม 1");

  // a stop not filled yet can still be removed during the day
  await page.getByRole("button", { name: "ลบจุดที่ 3" }).click();
  await expect(page.getByRole("status")).toHaveText("ลบจุดแล้ว");
  await expect(rows).toHaveCount(2);
});

test("copy yesterday's route into an empty day; viewers of other roles can't plan", async ({ page }) => {
  await login(page, "store");
  await page.goto("/routes?date=2026-11-28");
  await page.getByRole("button", { name: "คัดลอกจากวันก่อน" }).click();
  await expect(page.getByRole("status")).toContainText("คัดลอกเส้นทางจากวันที่ 2026-11-27 แล้ว");
  await expect(page.getByTestId("route-stop")).toHaveCount(2);
  await expect(page.getByTestId("route-stop").nth(0)).toContainText("ยังไม่ไป");

  await page.context().clearCookies();
  await login(page, "viewer");
  await page.goto("/routes");
  await expect(page).toHaveURL("/");
});
