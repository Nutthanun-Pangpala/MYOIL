import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Source of truth for the database. `npm run db:push` applies it.
 * Dates are ISO strings (`mode: "string"`), liters/baht are JS numbers (`mode: "number"`) —
 * all arithmetic goes through src/domain/money.ts, never plain float maths.
 */

const liters = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });
const baht = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
const stamp = (name: string) => timestamp(name, { withTimezone: true }).defaultNow().notNull();

// ───────────── people ─────────────

/** brief §3: 4 groups. system_admin can do everything store_admin can. */
export const roleEnum = pgEnum("role", ["store_admin", "project_viewer", "executive", "system_admin"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: stamp("created_at"),
});

// ───────────── projects (owned by BookCare — MYOIL only reads) ─────────────

/**
 * Read-only mirror of BookCare's project list. MYOIL never inserts/edits these from a screen;
 * only the sync job (src/server/projects) writes here. How the data gets here is still a proposal
 * (see ProjectSource) — the table shape follows BookCare's `projects`: ref_code, project_code, name, is_active.
 */
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  refCode: text("ref_code").notNull().unique(), // e.g. PNKK
  projectCode: text("project_code"), // accounting code, NOT unique
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  syncedAt: stamp("synced_at"),
});

/** project_viewer sees only these projects */
export const userProjects = pgTable(
  "user_projects",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.projectId] })],
);

// ───────────── prices & stock ─────────────

/** ราคาประจำวัน — one price per date; a date with none uses the latest earlier one (domain/price.ts) */
export const fuelPrices = pgTable(
  "fuel_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    priceDate: date("price_date", { mode: "string" }).notNull().unique(),
    pricePerLiter: numeric("price_per_liter", { precision: 8, scale: 2, mode: "number" }).notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: stamp("created_at"),
  },
  (t) => [check("fuel_prices_positive", sql`${t.pricePerLiter} > 0`)],
);

/** การซื้อน้ำมันเข้ารถ — the only truck is one, so there is no vehicle column */
export const fuelPurchases = pgTable(
  "fuel_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
    liters: liters("liters").notNull(),
    pricePerLiter: numeric("price_per_liter", { precision: 8, scale: 2, mode: "number" }).notNull(),
    amount: baht("amount").notNull(), // liters × price, from domain/money.ts at save time
    billNo: text("bill_no"), // เลขที่บิลหรือใบกำกับภาษี
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: stamp("created_at"),
    // never deleted: a cancelled purchase stays visible with its reason (OBS-18)
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
  },
  (t) => [index("fuel_purchases_date_idx").on(t.purchaseDate), check("fuel_purchases_liters_positive", sql`${t.liters} > 0`)],
);

/** history of a purchase: who changed what, old → new (OBS-18) */
export const purchaseAudit = pgTable(
  "purchase_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => fuelPurchases.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    action: text("action", { enum: ["create", "update", "cancel", "restore"] }).notNull(),
    changes: jsonb("changes"), // { field: [before, after] }
    at: stamp("at"),
  },
  (t) => [index("purchase_audit_purchase_idx").on(t.purchaseId)],
);

/** ยอดที่วัดได้จริง — compared with the book, difference shown (never blocks) */
export const stockChecks = pgTable("stock_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkDate: date("check_date", { mode: "string" }).notNull().unique(),
  measuredLiters: liters("measured_liters").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: stamp("created_at"),
});

/** หมายเหตุ of one day in the balance book (free text, one per day) */
export const ledgerNotes = pgTable("ledger_notes", {
  noteDate: date("note_date", { mode: "string" }).primaryKey(),
  note: text("note").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: stamp("updated_at"),
});

/** photo of the purchase bill, kept in the database (a downsized JPEG/PNG ≤ 1 MB): no file storage to run or back up */
export const purchaseBillPhotos = pgTable("purchase_bill_photos", {
  purchaseId: uuid("purchase_id")
    .primaryKey()
    .references(() => fuelPurchases.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  createdAt: stamp("created_at"),
});

/** single row (id = 1). Capacity unknown yet (open question 11) → nullable; empty = show liters only */
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  tankCapacityLiters: liters("tank_capacity_liters"),
  lowLevelLiters: liters("low_level_liters"),
  openingLiters: liters("opening_liters").notNull().default(0), // book balance before the first record
  openingDate: date("opening_date", { mode: "string" }),
});

// ───────────── claim cycles & invoices ─────────────

export const cycleStatusEnum = pgEnum("cycle_status", ["open", "closed"]);

/**
 * รอบเคลม. Start/end are data (open question 1: calendar month or the 20th?).
 * An issue belongs to a cycle through `fuel_issues.claim_cycle_id`, not by date alone (open question 10).
 */
export const claimCycles = pgTable(
  "claim_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    status: cycleStatusEnum("status").notNull().default("open"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by").references(() => users.id),
    createdAt: stamp("created_at"),
  },
  (t) => [unique("claim_cycles_start_unique").on(t.startDate), check("claim_cycles_dates", sql`${t.startDate} <= ${t.endDate}`)],
);

/** history of close / reopen. Reopen = system_admin only, reason required (brief §7). */
export const cycleEvents = pgTable("cycle_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  cycleId: uuid("cycle_id")
    .notNull()
    .references(() => claimCycles.id, { onDelete: "cascade" }),
  action: text("action", { enum: ["close", "reopen"] }).notNull(),
  reason: text("reason"), // required for "reopen" (enforced in the service)
  userId: uuid("user_id").references(() => users.id),
  at: stamp("at"),
});

export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent_to_pm", "pm_signed", "sent_to_accounting"]);

/**
 * ใบแจ้งค่าใช้จ่าย — one per (cycle, project). Its rows are the signed issues of that cycle+project,
 * read at query time (domain/rules.ts countsInInvoice), so there is nothing to keep in step.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => claimCycles.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    /** the code in the total row — the admin types it when issuing (open question 6) */
    totalRowCode: text("total_row_code"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
    createdAt: stamp("created_at"),
  },
  (t) => [unique("invoices_cycle_project_unique").on(t.cycleId, t.projectId)],
);

// ───────────── machines ─────────────

/** เครื่องจักร / รถ / เครื่องเช่า. The admin can add one on the spot while keying a slip (open question 7). */
export const machines = pgTable("machines", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(), // as first typed: PC210, FL022, "รถหกล้อ 50-9653"
  key: text("key").notNull().unique(), // machineKey(code): trimmed, single spaces, lower case — the identity
  name: text("name"),
  type: text("type"),
  assetCode: text("asset_code"),
  isRented: boolean("is_rented").notNull().default(false),
  createdAt: stamp("created_at"),
});

// ───────────── fuel issues (ใบจ่ายน้ำมัน) ─────────────

export const fuelIssues = pgTable(
  "fuel_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookNo: text("book_no").notNull(), // เล่มที่
    docNo: text("doc_no").notNull(), // เลขที่
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    claimCycleId: uuid("claim_cycle_id").references(() => claimCycles.id),
    timeIn: text("time_in"), // "HH:MM", optional
    timeOut: text("time_out"),
    fuelDriver: text("fuel_driver"), // พขร.เติมน้ำมัน
    machineDriver: text("machine_driver"), // พขร.ดูแลเครื่องจักร
    receivedSigned: boolean("received_signed").notNull().default(false),
    receiverName: text("receiver_name"), // required only when received_signed (domain/rules.ts)
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    /** stage 2: who recorded it (office admin now, the driver later) */
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: stamp("created_at"),
    updatedAt: stamp("updated_at"),
  },
  (t) => [
    unique("fuel_issues_book_doc_unique").on(t.bookNo, t.docNo), // เล่มที่+เลขที่ห้ามซ้ำ
    index("fuel_issues_date_idx").on(t.issueDate),
    index("fuel_issues_project_idx").on(t.projectId),
    index("fuel_issues_cycle_idx").on(t.claimCycleId),
  ],
);

/**
 * one issue → many machine lines. Price and amount are frozen when saved (a closed cycle must not drift).
 * No price for the date (and none earlier) → price/amount stay NULL = "รอราคา"; they are filled when a price is set.
 */
export const fuelIssueLines = pgTable(
  "fuel_issue_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => fuelIssues.id, { onDelete: "cascade" }),
    position: integer("position").notNull(), // ลำดับ 1..n
    machineId: uuid("machine_id")
      .notNull()
      .references(() => machines.id),
    hourMeter: numeric("hour_meter", { precision: 12, scale: 1, mode: "number" }), // ชั่วโมงการทำงาน / เลขไมล์, optional
    liters: liters("liters").notNull(),
    pricePerLiter: numeric("price_per_liter", { precision: 8, scale: 2, mode: "number" }),
    amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }),
  },
  (t) => [
    index("fuel_issue_lines_issue_idx").on(t.issueId),
    index("fuel_issue_lines_machine_idx").on(t.machineId),
    check("fuel_issue_lines_liters_positive", sql`${t.liters} > 0`),
  ],
);

/** several photos per issue (meter photos) — stage 2 uses it, the table exists so stage 1 doesn't need a migration */
export const fuelIssuePhotos = pgTable("fuel_issue_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => fuelIssues.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  createdAt: stamp("created_at"),
});

/** every edit of an issue: who changed what, when (brief §7) */
export const fuelIssueAudit = pgTable(
  "fuel_issue_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => fuelIssues.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    action: text("action", { enum: ["create", "update", "cancel", "restore"] }).notNull(),
    changes: jsonb("changes"), // { field: [before, after] }
    at: stamp("at"),
  },
  (t) => [index("fuel_issue_audit_issue_idx").on(t.issueId)],
);
