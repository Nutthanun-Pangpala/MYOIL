/**
 * Mockup data for demos, LOCAL ONLY: `npm run db:mockup` (runs the seed first, which wipes every fuel record).
 * Goes through the real services, so prices, cycles and amounts follow the real rules.
 * About 5 weeks of purchases and slips relative to today, a closed cycle with slips carried over,
 * a few cancelled / unsigned / waiting-for-price slips, notes and a tank measurement.
 */
import { eq, inArray } from "drizzle-orm";
import { db, schema, client } from "./index";
import { createPurchase } from "../server/purchases/purchase-service";
import { createIssue } from "../server/issues/issue-service";
import { cancelIssue } from "../server/issues/issue-service";
import { closeCycle } from "../server/cycles/cycle-service";
import { setLedgerNote, setStockCheck } from "../server/ledger/ledger-service";
import type { IssueInput } from "../domain/issue-check";
import type { Session } from "../lib/session";
import { randomUUID } from "node:crypto";
import { addStop, fillStop, routeForDate, skipStop } from "../server/routes/route-service";

const DAYS = 35;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const t = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() - n);
  return iso(t);
};

// small deterministic generator, so the demo looks the same every time
let seed = 20261122;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];

const MACHINES = ["PC210", "PC200", "รถบรรทุก 70-1234", "รถบรรทุก 71-5678", "L-A", "L-B", "เครื่องปั่นไฟ G1", "รถเครน C-01"] as const;
const FUEL_DRIVERS = ["สมชาย", "วิชัย", "ประสิทธิ์"] as const;
const MACHINE_DRIVERS = ["อนันต์", "ธีระ", "บุญมี", "สุรชัย", "ณัฐพล"] as const;
const RECEIVERS = ["อนันต์", "ธีระ", "บุญมี", "สมศักดิ์"] as const;

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("refusing to run in production");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, "store@myoil.local"));
  if (!user) throw new Error("run npm run db:seed first (or use npm run db:mockup)");
  const session: Session = { userId: user.id, role: user.role, name: user.name };

  const projects = await db
    .select()
    .from(schema.projects)
    .where(inArray(schema.projects.refCode, ["YARD", "DEMO1", "DEMO2"]));
  const pid = Object.fromEntries(projects.map((p) => [p.refCode, p.id]));

  // purchases: every ~5 days, price drifting around 32–35 baht (the first one is 33 days ago, so the two oldest days wait for a price)
  const prices = [32.5, 32.5, 33.0, 33.75, 34.25, 34.25, 33.5, 32.75];
  let n = 0;
  for (let ago = DAYS - 2; ago >= 0; ago -= 5) {
    const r = await createPurchase(session, {
      date: daysAgo(ago),
      time: "08:00",
      liters: 6000 + Math.round(rnd() * 4) * 500,
      price: prices[n++ % prices.length],
      amount: null,
      billNo: `INV-${String(1000 + n)}`,
      note: n === 3 ? "ซื้อเพิ่มก่อนวันหยุดยาว" : "",
      billPhoto: null,
      confirmed: true,
    });
    if (!r.ok) console.warn("purchase", daysAgo(ago), r.error);
  }

  // slips: 2–4 a day (fewer on Sundays), two books
  let doc = 1;
  let book = 1;
  const made: { id: string; date: string }[] = [];
  for (let ago = DAYS; ago >= 0; ago--) {
    const date = daysAgo(ago);
    const sunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
    const count = sunday ? 1 : 2 + Math.floor(rnd() * 3);
    if (ago === 18) { book = 2; doc = 1; }
    for (let i = 0; i < count; i++) {
      const used = new Set<string>();
      const lines = Array.from({ length: 1 + Math.floor(rnd() * 2) }, () => {
        let m = pick(MACHINES);
        while (used.has(m)) m = pick(MACHINES);
        used.add(m);
        const truck = m.startsWith("รถบรรทุก");
        return { machine: m, hourMeter: truck ? null : 1200 + Math.round(rnd() * 800), liters: (truck ? 80 : 120) + Math.round(rnd() * 12) * 10 };
      });
      const signed = ago > 2 && rnd() < 0.8; // the newest slips and some others still wait for the paper copy
      const input: IssueInput = {
        bookNo: String(book),
        docNo: String(doc++),
        issueDate: date,
        projectId: pid[pick(["DEMO1", "DEMO1", "DEMO2", "YARD"] as const)] ?? null,
        timeIn: "08:30",
        timeOut: "09:00",
        fuelDriver: pick(FUEL_DRIVERS),
        machineDriver: pick(MACHINE_DRIVERS),
        lines,
        receivedSigned: signed,
        receiverName: signed ? pick(RECEIVERS) : "",
      };
      const r = await createIssue(session, input);
      if (r.ok) made.push({ id: r.id, date });
      else console.warn("slip", date, input.bookNo, input.docNo, JSON.stringify(r.check));
    }
  }

  // two cancelled slips with a reason
  for (const m of [made[made.length - 8], made[made.length - 20]]) {
    if (m) await cancelIssue(session, m.id, "กรอกผิดเล่ม ออกใบใหม่แทน");
  }

  // close last month's cycle: unsigned slips carry over to this month
  const cycles = await db.select().from(schema.claimCycles);
  const thisMonth = daysAgo(0).slice(0, 7);
  const last = cycles.filter((c) => c.endDate < `${thisMonth}-01`).sort((a, b) => (a.endDate < b.endDate ? 1 : -1))[0];
  if (last) {
    const r = await closeCycle(session, last.id);
    if (!r.ok) console.warn("close cycle:", r.message);
    else if (r.carried) console.log(`closed ${last.startDate}…${last.endDate}, carried ${r.carried.slips} slips`);
  }

  await setLedgerNote(session, daysAgo(10), "รถบรรทุกน้ำมันมาส่งช้า");
  await setLedgerNote(session, daysAgo(3), "ปิดถังตรวจสอบ");
  await setStockCheck(session, daysAgo(3), 4200);

  // ── the fuel truck's routes (driver screens, 25 Nov 2026): yesterday done (2 filled, 1 skipped), today 3 stops to go ──
  await db.update(schema.appSettings).set({ tankCapacityLiters: 12000 }).where(eq(schema.appSettings.id, 1));
  const yesterday = daysAgo(1);
  const ySlips = await db.select({ id: schema.fuelIssues.id, projectId: schema.fuelIssues.projectId }).from(schema.fuelIssues).where(eq(schema.fuelIssues.issueDate, yesterday));
  const live = ySlips.filter((x) => x.projectId).slice(0, 2);
  for (const sl of live) await addStop(user.id, yesterday, sl.projectId!, null);
  await addStop(user.id, yesterday, pid.DEMO2, "เติมเครื่องปั่นไฟ G1");
  const y = await routeForDate(yesterday);
  if (y) {
    await db.transaction(async (tx) => {
      for (const [i, sl] of live.entries()) await fillStop(tx, y.stops[i].id, sl.id);
    });
    const last = y.stops[y.stops.length - 1];
    await skipStop(last.id, { skipRef: randomUUID(), reason: "เข้าหน้างานไม่ได้ / หน้างานปิด", skippedAt: `${yesterday}T15:40:00+07:00`, driver: { bookcareUserId: "", name: "สุชาติ แก้วใส (demo)" } });
  }
  await addStop(user.id, daysAgo(0), pid.DEMO1, "เติม PC210 ก่อน 9 โมง");
  await addStop(user.id, daysAgo(0), pid.DEMO2, null);
  await addStop(user.id, daysAgo(0), pid.YARD, "รอบบ่าย เติมรถบรรทุก 2 คัน");

  console.log(`mockup ready: ${n} purchases, ${made.length} slips. demo logins as in db:seed (password myoil1234)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
