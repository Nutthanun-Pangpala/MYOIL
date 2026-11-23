import { createHash, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { TEST_PUSH_KEY } from "../playwright.config";
import { planStop, planStops, resetData } from "./helpers";

/** API contract v1 (BookCare ↔ MYOIL), calls 1–6. Needs a dev server started by Playwright (it carries the test key). */
const BASE = "/api/bookcare/v1";
const auth = { Authorization: `Bearer ${TEST_PUSH_KEY}` };

const jpeg = (seed: string) => {
  const data = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(seed)]);
  return { mime: "image/jpeg", sha256: createHash("sha256").update(data).digest("hex"), takenAt: "2026-11-23T10:08:12+07:00", data: data.toString("base64") };
};

const issueBody = (over: Record<string, unknown> = {}) => {
  const b = { ...issueDefaults(), ...over } as ReturnType<typeof issueDefaults> & { routeStopId?: string };
  // each slip fills its own stop of the route; an unknown project is refused before the stop is looked at
  return { ...b, routeStopId: b.routeStopId ?? (b.projectRefCode === "NOPE" ? randomUUID() : planStop(b.issueDate, b.projectRefCode)) };
};

const issueDefaults = () => ({
  ref: randomUUID(),
  projectRefCode: "DEMO1",
  issueDate: "2026-11-23",
  timeIn: "10:05",
  timeOut: "10:21",
  recordedAt: "2026-11-23T10:05:00+07:00",
  driver: { bookcareUserId: "bc-user-1", name: "สมชาย ใจดี" },
  vehicleCode: "OIL-1",
  lines: [{ position: 1, machineId: null, machineCode: "PC210", liters: "120", hourMeter: "1532.5", photo: jpeg("meter-1") }],
  signature: { receiverName: "สมศรี", signedAt: "2026-11-23T10:21:30+07:00", image: jpeg("sign-1") },
  unsignedReason: null as string | null,
  confirmedWarnings: [] as string[],
});

const post = (request: APIRequestContext, path: string, body: unknown, headers = auth) => request.post(`${BASE}${path}`, { data: body, headers });
const get = (request: APIRequestContext, path: string, headers: Record<string, string> = auth) => request.get(`${BASE}${path}`, { headers });

test.describe.configure({ mode: "serial" });
test.beforeAll(() => resetData());

test("the key is checked on every call", async ({ request }) => {
  expect((await post(request, "/issues", issueBody(), {} as never)).status()).toBe(401);
  expect((await post(request, "/issues", issueBody(), { Authorization: "Bearer wrong" })).status()).toBe(401);
  expect((await get(request, "/tank", {})).status()).toBe(401);
  const res = await get(request, "/tank", { Authorization: "Bearer nope" });
  expect((await res.json()).error.code).toBe("unauthorized");
});

test("API 1: a slip is stored once however often it is sent", async ({ request }) => {
  const body = issueBody();
  const first = await post(request, "/issues", body);
  expect(first.status()).toBe(201);
  const a = await first.json();
  expect(a).toMatchObject({ bookNo: "M6911", docNo: "0001", status: "pending_review", signed: true, duplicate: false });
  expect(a.issueId).toMatch(/^[0-9a-f-]{36}$/);
  expect(a.flags).toContain("new_machine:1");

  const again = await post(request, "/issues", body);
  expect(again.status()).toBe(200);
  expect(await again.json()).toMatchObject({ issueId: a.issueId, bookNo: "M6911", docNo: "0001", duplicate: true });

  const changed = await post(request, "/issues", { ...body, lines: [{ ...body.lines[0], liters: "121" }] });
  expect(changed.status()).toBe(409);
  expect((await changed.json()).error.code).toBe("ref_conflict");

  const next = await (await post(request, "/issues", issueBody())).json();
  expect(next.docNo).toBe("0002");
});

test("API 1: refuses what the office rules refuse, and says which field", async ({ request }) => {
  const bad = issueBody();
  (bad.lines[0] as { liters: string }).liters = "10.005";
  const r = await post(request, "/issues", bad);
  expect(r.status()).toBe(400);
  expect((await r.json()).error).toMatchObject({ code: "invalid", field: "lines[0].liters" });

  const unknown = await post(request, "/issues", issueBody({ projectRefCode: "NOPE" }));
  expect(unknown.status()).toBe(404);
  expect((await unknown.json()).error.code).toBe("unknown_project");

  const notJpeg = issueBody();
  (notJpeg.lines[0] as { photo: unknown }).photo = { ...jpeg("x"), data: Buffer.from("hello").toString("base64"), sha256: createHash("sha256").update("hello").digest("hex") };
  expect((await post(request, "/issues", notJpeg)).status()).toBe(400);
});

test("API 1 + 3: an unsigned slip can be signed later, once", async ({ request }) => {
  const body = issueBody({ signature: null, unsignedReason: "ผู้รับไม่อยู่", lines: [{ position: 1, machineId: null, machineCode: "PC210", liters: "50", hourMeter: null, photo: jpeg("meter-2") }] });
  const sent = await (await post(request, "/issues", body)).json();
  expect(sent.signed).toBe(false);

  const sig = { signatureRef: randomUUID(), receiverName: "สมศรี", signedAt: "2026-11-24T08:15:00+07:00", image: jpeg("sign-2") };
  const ok = await post(request, `/issues/${body.ref}/signature`, sig);
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toEqual({ signed: true, flags: [] });
  expect(await (await post(request, `/issues/${body.ref}/signature`, sig)).json()).toEqual({ signed: true, duplicate: true });
  const other = await post(request, `/issues/${body.ref}/signature`, { ...sig, signatureRef: randomUUID() });
  expect(await other.json()).toEqual({ signed: true, flags: ["already_signed"] });
  expect((await post(request, `/issues/${randomUUID()}/signature`, sig)).status()).toBe(404);

  const st = await (await get(request, `/issues/status?refs=${body.ref}`)).json();
  expect(st.issues[0]).toMatchObject({ ref: body.ref, review: "pending_review", signed: true, signedLate: true });

  // a slip signed when it was sent is not "signed late"
  const atSite = issueBody();
  await post(request, "/issues", atSite);
  const st2 = await (await get(request, `/issues/status?refs=${atSite.ref}`)).json();
  expect(st2.issues[0]).toMatchObject({ signed: true, signedLate: false });
});

test("API 2 + 5: a purchase waits for confirmation and counts in the tank at once", async ({ request }) => {
  const before = Number((await (await get(request, "/tank")).json()).liters);
  const body = { ref: randomUUID(), purchaseDate: "2026-11-23", recordedAt: null, driver: { bookcareUserId: "bc-user-1", name: "สมชาย" }, liters: "2000", amount: "64980.00", billNo: "INV-1", billPhoto: jpeg("bill-1") };
  const r = await post(request, "/purchases", body);
  expect(r.status()).toBe(201);
  const made = await r.json();
  expect(made).toMatchObject({ status: "pending_confirm", duplicate: false });
  expect(made.purchaseId).toMatch(/^[0-9a-f-]{36}$/);
  expect((await post(request, "/purchases", body)).status()).toBe(200);
  expect((await post(request, "/purchases", { ...body, amount: "1.00" })).status()).toBe(409);

  const tank = await (await get(request, "/tank")).json();
  expect(Number(tank.liters)).toBe(before + 2000);
  expect(tank.includedRefs).toContain(body.ref);
  expect(tank.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/);
  expect(tank.today).toEqual({ issues: expect.any(Number), litersOut: expect.stringMatching(/^\d+(\.\d{1,2})?$/) });
});

test("API 4: maxLiters stays null until a machine has 3 fills in 90 days", async ({ request }) => {
  const list = (await (await get(request, "/machines")).json()).machines as { id: string; code: string; maxLiters: string | null; lastFilledAt: string | null }[];
  const fresh = list.find((m) => m.lastFilledAt === null);
  test.skip(!fresh, "every demo machine already has history");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const fill = (liters: string, n: number) =>
    post(request, "/issues", issueBody({ issueDate: today, signature: null, unsignedReason: "ผู้รับไม่อยู่", lines: [{ position: 1, machineId: fresh!.id, machineCode: fresh!.code, liters, hourMeter: null, photo: jpeg(`fresh-${n}`) }] }));
  const maxOf = async () => ((await (await get(request, "/machines")).json()).machines as typeof list).find((m) => m.id === fresh!.id)!;

  expect((await fill("40", 1)).status()).toBe(201);
  expect((await fill("90", 2)).status()).toBe(201);
  expect(await maxOf()).toMatchObject({ maxLiters: null, lastFilledAt: today });
  expect((await fill("60", 3)).status()).toBe(201);
  expect(await maxOf()).toMatchObject({ maxLiters: "90" });
});

test("API 4 + 6: machines (held names not offered, etag) and unknown refs", async ({ request }) => {
  const res = await get(request, "/machines");
  const list = await res.json();
  expect(list.machines.find((m: { code: string }) => m.code === "PC210")).toBeUndefined(); // typed on the phone → "รอตรวจชื่อ"
  const etag = res.headers()["etag"];
  expect(etag).toBeTruthy();
  const again = await get(request, "/machines", { ...auth, "If-None-Match": etag });
  expect(again.status()).toBe(304);

  const ghost = randomUUID();
  expect(await (await get(request, `/issues/status?refs=${ghost}`)).json()).toEqual({ issues: [], unknownRefs: [ghost] });
  expect((await get(request, "/issues/status")).status()).toBe(400);
});

test("API 8 + 1 + 9: the route of the day, a slip fills its stop, a skip needs a reason, no stop = refused", async ({ request }) => {
  const day = "2026-11-25";
  const [s1, s2, s3] = planStops(day, ["DEMO1", "DEMO2", "DEMO1"]);
  const r = await (await get(request, `/route?date=${day}`)).json();
  expect(r.stops.map((s: { id: string; position: number; projectRefCode: string; status: string }) => [s.id, s.position, s.projectRefCode, s.status])).toEqual([
    [s1, 1, "DEMO1", "pending"],
    [s2, 2, "DEMO2", "pending"],
    [s3, 3, "DEMO1", "pending"],
  ]);
  expect((await (await get(request, "/route?date=2026-11-26")).json()).stops).toEqual([]);

  // a slip with no stop, an unknown stop, or another project's stop is refused
  // (a routeStopId given to issueBody() stops it from planning a stop of its own, which would add a 4th stop to this day)
  const none = await post(request, "/issues", { ...issueBody({ issueDate: day, routeStopId: randomUUID() }), routeStopId: null });
  expect(none.status()).toBe(400);
  expect((await none.json()).error.code).toBe("no_route_stop");
  expect((await (await post(request, "/issues", issueBody({ issueDate: day, routeStopId: randomUUID() }))).json()).error.code).toBe("no_route_stop");
  const wrong = await post(request, "/issues", issueBody({ issueDate: day, routeStopId: s2 }));
  expect(wrong.status()).toBe(400);
  expect((await wrong.json()).error.field).toBe("routeStopId");

  // stop 1 filled, once
  const ref = randomUUID();
  expect((await post(request, "/issues", issueBody({ ref, issueDate: day, routeStopId: s1 }))).status()).toBe(201);
  const twice = await post(request, "/issues", issueBody({ issueDate: day, routeStopId: s1 }));
  expect(twice.status()).toBe(409);
  expect((await twice.json()).error.code).toBe("stop_filled");

  // stop 2 skipped with a reason, once
  const skip = { skipRef: randomUUID(), reason: "หน้างานปิด", skippedAt: `${day}T11:02:00+07:00`, driver: { bookcareUserId: "bc-1", name: "สมชาย" } };
  expect((await post(request, `/route/stops/${s2}/skip`, { ...skip, reason: "" })).status()).toBe(400);
  expect(await (await post(request, `/route/stops/${s2}/skip`, skip)).json()).toEqual({ status: "skipped" });
  expect(await (await post(request, `/route/stops/${s2}/skip`, skip)).json()).toEqual({ status: "skipped", duplicate: true });
  expect((await (await post(request, `/route/stops/${s1}/skip`, { ...skip, skipRef: randomUUID() })).json()).error.code).toBe("stop_filled");
  expect((await post(request, `/route/stops/${randomUUID()}/skip`, { ...skip, skipRef: randomUUID() })).status()).toBe(404);

  const after = await (await get(request, `/route?date=${day}`)).json();
  expect(after.stops.map((s: { status: string }) => s.status)).toEqual(["filled", "skipped", "pending"]);
  expect(after.stops[0].issueRef).toBe(ref);
  expect(after.stops[1].skipReason).toBe("หน้างานปิด");

  // a skipped stop can still be filled later: accepted, flagged
  const late = await (await post(request, "/issues", issueBody({ issueDate: day, projectRefCode: "DEMO2", routeStopId: s2 }))).json();
  expect(late.flags).toContain("was_skipped");
});
