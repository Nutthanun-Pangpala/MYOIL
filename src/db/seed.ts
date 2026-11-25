/**
 * Demo data for local development ONLY. Never run against a shared/production database:
 * it WIPES every fuel record (issues, purchases, prices, cycles, invoices…) and the demo accounts first.
 * The e2e tests rely on this to start from the same state each time.
 */
import { eq, inArray, like, or, sql } from "drizzle-orm";
import { db, schema, client } from "./index";
import { hashSecret } from "../lib/password";
import { driverEmail } from "../domain/driver-login";
import { StaticProjectSource } from "../server/projects/project-source";
import { syncProjects } from "../server/projects/sync-projects";

const DEMO_PASSWORD = "myoil1234";

const DEMO_USERS = [
  { name: "แอดมินสโตร์กลาง (demo)", email: "store@myoil.local", role: "store_admin" },
  { name: "ผู้ดูโครงการ (demo)", email: "viewer@myoil.local", role: "project_viewer" },
  { name: "ผู้บริหาร (demo)", email: "exec@myoil.local", role: "executive" },
  { name: "ผู้ดูแลระบบ (demo)", email: "admin@myoil.local", role: "system_admin" },
] as const;

// trial drivers (owner, 25 Nov 2026): phone + PIN at /login/driver. Local demo only.
const DEMO_PIN = "246810";
const DEMO_DRIVERS = [
  { name: "สุชาติ แก้วใส (demo)", phone: "0810000001" },
  { name: "วิชัย มั่นคง (demo)", phone: "0810000002" },
] as const;

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("refusing to seed in production");

  // records first (they point at users), `projects` stays; the book starts empty again
  await db.execute(
    sql`truncate table fuel_route_stops, fuel_routes, fuel_issue_audit, fuel_issue_photos, issue_signed_photos, fuel_issue_line_photos, fuel_issue_lines, fuel_issues, fuel_purchases, purchase_audit, purchase_bill_photos, ledger_notes, stock_checks, fuel_prices, invoices, cycle_events, claim_cycles, machines, user_projects restart identity cascade`,
  );
  await db.delete(schema.appSettings);

  // demo logins and anything the e2e specs created under the demo domain (a failed run leaves them behind)
  await db.delete(schema.users).where(
    or(
      inArray(
        schema.users.email,
        DEMO_USERS.map((u) => u.email),
      ),
      like(schema.users.email, "%@myoil.local"),
      // every driver account: the e2e specs add drivers with other phones ("เพิ่มคนขับ"), and one left behind makes the next run's phone "already used"
      eq(schema.users.role, "driver"),
    ),
  );
  await db.insert(schema.users).values(DEMO_DRIVERS.map((d) => ({ name: d.name, phone: d.phone, email: driverEmail(d.phone), role: "driver" as const, passwordHash: hashSecret(DEMO_PIN) })));
  await db.insert(schema.users).values(DEMO_USERS.map((u) => ({ ...u, passwordHash: hashSecret(DEMO_PASSWORD) })));

  // placeholder projects until the BookCare link is decided; the yard counts as a project (BA proposal)
  await syncProjects(
    new StaticProjectSource([
      { refCode: "YARD", projectCode: null, name: "ยาร์ดลำลูกกา (ใช้เอง)", isActive: true },
      { refCode: "DEMO1", projectCode: "D001", name: "โครงการตัวอย่าง 1", isActive: true },
      { refCode: "DEMO2", projectCode: "D002", name: "โครงการตัวอย่าง 2", isActive: true },
    ]),
  );

  // one purchase bill today (Bangkok): 5,000 liters at 32.50, so the truck has fuel and a slip keyed today shows an amount
  // (a slip takes its price from the latest bill on or before its date; key one for an earlier date to see "รอราคา")
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  await db.insert(schema.fuelPurchases).values({ purchaseDate: today, purchaseTime: "00:01", liters: 5000, pricePerLiter: 32.5, amount: 162500, billNo: "DEMO-0001", note: "ข้อมูลตัวอย่าง" });

  await db
    .insert(schema.appSettings)
    .values({ id: 1 })
    .onConflictDoNothing();

  console.log("seeded. demo logins (password for all: %s):", DEMO_PASSWORD);
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(15)} ${u.email}`);
  console.log("demo drivers at /login/driver (PIN for all: %s):", DEMO_PIN);
  for (const d of DEMO_DRIVERS) console.log(`  ${d.phone}  ${d.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
