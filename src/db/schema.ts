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

/** brief §3: 4 office groups. system_admin can do everything store_admin can.
 *  `driver` (owner, 25 Nov 2026) = the fuel-truck driver: phone + PIN, only the /driver screens. */
export const roleEnum = pgEnum("role", ["store_admin", "project_viewer", "executive", "system_admin", "driver"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: stamp("created_at"),
  // drivers sign in with phone + 6-digit PIN (hash in password_hash; email is "<phone>@driver.invalid")
  phone: text("phone").unique(),
  // a 6-digit PIN can be guessed, so wrong tries are counted and the account rests for a while
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
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
  /** last time BookCare's list carried it (for a project added by hand: when it was added) */
  syncedAt: stamp("synced_at"),
  /** added by an admin in MYOIL, not sent by BookCare */
  addedLocally: boolean("added_locally").notNull().default(false),
  /**
   * set when an admin adds, edits, opens or closes it on ตั้งค่า › โครงการ. From then on MYOIL's values win:
   * the BookCare sync leaves its code, name and open/closed alone (owner, 26 Nov 2026: sync AND add by hand).
   */
  localEditAt: timestamp("local_edit_at", { withTimezone: true }),
  /** where the site is, for the driver and the receiver: address, district, landmark (OBS-23). MYOIL's own; the BookCare sync never touches it */
  siteDetail: text("site_detail"),
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
    /** "HH:MM" on the bill (B1, B9): with the date it puts the bills in the order their fuel is used up */
    purchaseTime: text("purchase_time"),
    billNo: text("bill_no"), // เลขที่บิลหรือใบกำกับภาษี
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: stamp("created_at"),
    // never deleted: a cancelled purchase stays visible with its reason (OBS-18)
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    /** stage 2: 'office' = keyed by staff, 'mobile' = sent by BookCare; mobile ones wait for an admin ("pending_confirm") */
    source: text("source").notNull().default("office"),
    externalRef: uuid("external_ref").unique(),
    status: text("status").notNull().default("confirmed"), // confirmed | pending_confirm
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    driverName: text("driver_name"),
    driverBookcareId: text("driver_bookcare_id"),
    requestHash: text("request_hash"),
    flags: jsonb("flags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
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
  /** day of the month a claim cycle is cut on (1–28); null = the last day of the calendar month */
  cycleCutDay: integer("cycle_cut_day"),
  /** price per liter of the opening stock (B8): it is used up before the first bill; null = those liters wait for a price */
  openingPrice: numeric("opening_price", { precision: 8, scale: 2, mode: "number" }),
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
  /** stage 2: a name a driver typed on the phone that matches nothing — held until an admin merges or accepts it */
  pendingReview: boolean("pending_review").notNull().default(false),
  /**
   * "ลบ" on ตั้งค่า › เครื่องจักร (owner, 26 Nov 2026). A machine no slip ever used is really deleted; one that slips point at
   * only gets this stamp: gone from every list and picker, while its old slips, reports and invoices still show it.
   * Typing the same code again (in settings or on a slip) brings it back.
   */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
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
    /** stage 2: 'paper' = keyed by staff, 'mobile' = sent by BookCare (needs "ตรวจแล้ว" before it can be invoiced) */
    source: text("source").notNull().default("paper"),
    externalRef: uuid("external_ref").unique(), // the phone's UUID: sending twice = one slip
    requestHash: text("request_hash"), // same ref + other content → 409 ref_conflict
    reviewStatus: text("review_status").notNull().default("checked"), // pending_review | checked
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }), // taken on site (phone clock)
    receivedAt: timestamp("received_at", { withTimezone: true }), // reached MYOIL
    driverBookcareId: text("driver_bookcare_id"),
    signatureRef: text("signature_ref"), // idempotency of the late signature
    unsignedReason: text("unsigned_reason"),
    flags: jsonb("flags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    confirmedWarnings: jsonb("confirmed_warnings").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    editedAfterSign: boolean("edited_after_sign").notNull().default(false), // R7
    /** the stop of the day's route this phone slip fills (contract §9.1); paper slips have none */
    routeStopId: uuid("route_stop_id"),
    /** the purchase bill this slip takes its price from (latest bill on or before its date); null = รอราคา */
    pricePurchaseId: uuid("price_purchase_id").references(() => fuelPurchases.id, { onDelete: "set null" }),
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
/** stage 2: the meter photo of one line, kept in the database (the old path-based fuel_issue_photos can't live on Vercel) */
export const fuelIssueLinePhotos = pgTable("fuel_issue_line_photos", {
  lineId: uuid("line_id")
    .primaryKey()
    .references(() => fuelIssueLines.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  sha256: text("sha256").notNull(),
  takenAt: timestamp("taken_at", { withTimezone: true }),
  data: bytea("data").notNull(),
  createdAt: stamp("created_at"),
});

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

/**
 * A line cut into the bills its liters came from (brief §14, oldest fuel first): one row per price.
 * 600 liters over two bills = [100 @32.50, 500 @33.10]. `kind`: bill | opening (the opening stock) | none (liters no
 * bill covers yet → no price). Rewritten for slips of open cycles whenever a bill or a slip changes; kept as billed
 * once the cycle is closed.
 */
export const fuelIssueLineParts = pgTable(
  "fuel_issue_line_parts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lineId: uuid("line_id")
      .notNull()
      .references(() => fuelIssueLines.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    kind: text("kind").notNull(),
    purchaseId: uuid("purchase_id").references(() => fuelPurchases.id, { onDelete: "set null" }),
    liters: liters("liters").notNull(),
    pricePerLiter: numeric("price_per_liter", { precision: 8, scale: 2, mode: "number" }),
    amount: baht("amount"),
  },
  (t) => [index("fuel_issue_line_parts_line_idx").on(t.lineId)],
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

/** photo of the signed paper slip (ใบเซ็น) — one per slip, kept in the database like the purchase bill photo (downsized JPEG/PNG ≤ 1 MB) */
export const issueSignedPhotos = pgTable("issue_signed_photos", {
  issueId: uuid("issue_id")
    .primaryKey()
    .references(() => fuelIssues.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
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

// ───────────── route of the fuel truck (stage 2, 23 Nov 2026) ─────────────
// The store admin plans each day: which projects, in which order, with a note. The driver can only fill
// (or skip) the stops of the day (brief R20–R23). One route per day (one truck), one slip per stop.

export const fuelRoutes = pgTable("fuel_routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeDate: date("route_date", { mode: "string" }).notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: stamp("created_at"),
  updatedAt: stamp("updated_at"),
});

/** status is not stored: filled = has a slip that isn't cancelled; skipped = skip_ref set; else pending (domain/route.ts) */
export const fuelRouteStops = pgTable(
  "fuel_route_stops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => fuelRoutes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    note: text("note"),
    issueId: uuid("issue_id").references(() => fuelIssues.id, { onDelete: "set null" }),
    skipRef: uuid("skip_ref").unique(),
    skipReason: text("skip_reason"),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    skippedBy: text("skipped_by"), // the driver's name from BookCare
    createdAt: stamp("created_at"),
    updatedAt: stamp("updated_at"),
  },
  (t) => [index("fuel_route_stops_route_idx").on(t.routeId), unique("fuel_route_stops_issue_unique").on(t.issueId)],
);
