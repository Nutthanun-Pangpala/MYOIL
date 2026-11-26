# MYOIL — สมุดบัญชีน้ำมัน สโตร์กลาง U WORK 999

UI text is **Thai**; code, identifiers and commits are **English**.
Source of truth for scope and rules: the brief (Project "Uwork แอพรถเติมน้ำมัน" › `claude/myoil-brief-summary.md`,
and the UX/UI brief it links). If this file disagrees with the brief, the brief wins.

## What it is
Webapp (separate from BookCare, same design tokens). The central-store admin keys each fuel issue slip
(ใบจ่ายน้ำมัน) **once**; the system produces the monthly table, the balance book (สมุดคงเหลือ) and the
cost invoice per project (ใบแจ้งค่าใช้จ่าย, A4 + Excel). One fuel truck only. Stage 1 = office side only;
paper slips stay. Stage 2 (driver on phone, photos, on-screen signature) is NOT built — but an issue
must support several photos and record who keyed it (tables exist already).

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind v4 · PostgreSQL + Drizzle · exceljs · Vitest.
(TypeScript / Tailwind / Drizzle / exceljs are the BA's proposal to match BookCare; Next.js + PostgreSQL are the owner's decision.)

## Architecture (dependencies point downward only)
```
src/app/        UI: pages, layouts, server actions. Thin — parse input, call a service, render.
src/server/     Application services + adapters (DB queries, project sync). Knows db + domain.
src/domain/     PURE rules: money, price lookup, ledger, cycle dates, what-counts-where. No db, no next, no Date.now().
src/db/         Drizzle schema (source of truth), connection, seed.
src/lib/        Cross-cutting: session, password, permissions, labels.
```
- A rule that changes a number or a status lives in `domain/` with a unit test next to it. Screens and actions never re-implement it.
- `domain/rules.ts` is the single answer to "does this slip count in the balance / monthly table / invoice". Use it in every query that builds those.
- Money and liters: always `domain/money.ts` (integer maths, 2 decimals). Never `a * b` on prices in a screen.
- Dates are ISO `YYYY-MM-DD` strings end to end.
- `projects` comes from BookCare **and** from admins since 26 Nov 2026 (see "Test round 17" at the end): admins add / rename / open / close on ตั้งค่า › โครงการ. The BookCare sync (`server/projects/sync-projects.ts`) still runs and never overwrites a project touched by hand (`projects.local_edit_at`).
- Server Components + Server Actions by default; API routes only when something outside the app needs them.

## Build status (22 Nov 2026)
Done: login/logout · side menu per role (full / icon rail / top bar) · issue list (6.3) · **key an issue (6.4)** with live checks · issue detail (6.5).
Placeholders (designed, not built): overview 6.2 · monthly table 6.8 · invoices 6.9/6.10 · settings 6.11.
Built: purchases + daily price 6.6 (`/purchases`; drawer is URL-driven `?new=purchase|price`). A new/changed daily price re-prices "รอราคา" lines (skips closed cycles) via `domain/reprice.ts`. Not yet: correcting a price does not re-price lines already priced; no edit/delete of a purchase.
Built: balance book 6.7 (`/ledger`: month picker, summary, daily table, "วัดได้จริง" saved on blur into `stock_checks`, Excel at `/ledger/export`; rules in `domain/ledger-rows.ts`). Side menu now has order search, "ในรถตอนนี้" (`stockOn`) and user card. Shared look matches the design canvas: Card/Button shadow, `table.t` in globals.css, month dropdown (`components/month-select.tsx`). Purchases form is a right-hand panel, not an overlay. Monthly table 6.8 (`/monthly`: all projects × day, or one project's machines × day via `?project=`; `domain/monthly-matrix.ts`, `server/monthly/monthly-service.ts`, Excel at `/monthly/export`; counts every non-cancelled slip, scoped by `visibleProjectIds`; sticky first/last columns = `table.m`). Overview 6.2 (`/`: `components/tank-panel.tsx` truck + odometer digits, store/admin small panel + to-do list, executive large panel; month summary + per-project table; `domain/overview.ts`, `server/overview/overview-service.ts`). Month picker, not claim cycles, until cycles exist; viewers see no tank. `/issues?signed=no` = unsigned slips. Not built from the design: bill photo on a purchase (no table for it yet), ledger "หมายเหตุ" column (nothing stores it).
E2E (Playwright, `e2e/`): `npm i` then `npm run e2e:install` once; `npm run test:e2e` needs Postgres up. Each spec file reseeds (`db:seed` now WIPES all fuel data — local only).
Not yet in the issue flow: photo attachments · edit / cancel an issue · cycle creation (so `claim_cycle_id` stays empty until cycles exist) · re-pricing "รอราคา" lines when a price is added later.
Live checks go through one path: `previewIssueAction` → `server/issues/issue-service.ts` → `domain/issue-check.ts`; saving runs the same rules again.

## Rules that break numbers (brief §7) — where each lives
| rule | where |
|---|---|
| amount = liters × price of the slip date, 2 decimals; no price that day → latest earlier price | `domain/money.ts`, `domain/price.ts` |
| balance may go negative: warn, never block | `domain/ledger.ts` |
| unsigned slip counts in balance + monthly, not in the invoice; cancelled counts nowhere | `domain/rules.ts` |
| receiver name required only when "signed" is ticked | `domain/rules.ts` |
| book no. + doc no. unique | `fuel_issues_book_doc_unique` |
| closed cycle: slips can't be edited; only `system_admin` reopens, with a reason, history kept, invoices go back to draft | `claim_cycles`, `cycle_events` (service: TODO) |
| every edit of a slip is logged (who, what, when) | `fuel_issue_audit` (service: TODO) |
| system creates the next cycle by itself | `domain/cycle.ts` `nextCycleAfter` |
| price and amount are frozen on each line when saved | `fuel_issue_lines.price_per_liter/amount` |

## Open questions — don't build these in until the owner answers (use the default)
1. Cycle = calendar month or cut-off on the 20th? → cycles are stored dates; default calendar month.
2. Billed price = purchase price of the day? → one daily price for both.
10. Unsigned slip at close → carry to next cycle (BA proposal). Slip ↔ cycle link is an explicit column, not derived from date alone.
11. Tank capacity / low-level warning → `app_settings` nullable; empty = show liters only.
12. Own-yard use (~29%) → the yard is one project (`YARD`).
6. Meaning of "ปรับงบลง PSY69" and the code in the total row → `invoices.total_row_code`, typed by the admin.
Invoice A4 print layout waits for the design fix (fix list item 1). Settings › projects is a read-only table.

## Design tokens
Same as BookCare (`src/app/globals.css`). Yellow = primary button and things that stand for fuel only.
No raw hex in components. Status = colour + word. Screens must work at 1440px first; PM/executive on iPad/phone not designed yet.
Extra tokens (24 Nov): `working|idle|repair` + `-soft`/`-ink`, `repair-line`, `repair-deep`, `gray-soft`/`gray-ink`, `warn-ink`; classes `.skeleton`, `dialog.confirm::backdrop`, `table.t` (`.n` = number column).

## Commands
```
npm run setup      # postgres (docker, port 5434) + push schema + seed demo data
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest, no DB)
npm run typecheck
npm run db:studio
```
Run `npm test`, `npm run typecheck` and `npm run build` before saying something is done.
Never run `db:seed` against a shared database — it deletes the demo accounts first.

## BA decisions 22 Nov 2026 (after test round 1–3)
- Cycle = calendar month, but stored as start/end dates (no "month" baked into code; if the owner says cut-off on the 20th it is a setting). Price of a slip = the daily price effective on the slip's date; a purchase at another price does not change slips, it only warns the admin.
- Unsigned slips at close: carried to the next cycle keeping their date and price; the close screen says how many slips/liters; ledger and monthly keep them in their own month, so invoice vs monthly can differ and needs an explaining line. Yard (ลำลูกกา) is a project like any other and gets an invoice.
- Liters and price per liter: at most 2 decimals, refused at the field (`hasAtMostTwoDecimals`, `TWO_DECIMALS_MESSAGE` in domain/money.ts) — never rounded. Amount = liters × price, half-up to 2 decimals. Future-dated prices allowed, shown "มีผลตั้งแต่วันที่ …"; "today's price" = effective on that day.
- Over-balance slips are saved with a warning that says to check the purchases are all keyed. Overview money = "มูลค่าน้ำมันที่จ่ายออก" (all non-cancelled) with a sub-line for unsigned. No tank size set → no "ใกล้หมด" status, "ยังไม่ได้ตั้งความจุถัง" + link to settings.

## Slip actions (22 Nov 2026)
- `/issues/[id]`: `IssueActionsPanel` — แก้ไข (`/issues/[id]/edit`, same `IssueForm` with `edit`), ติ๊กเซ็นรับ (name required), ยกเลิก (reason + confirm), นำกลับมา. Rules `domain/issue-actions.ts` (`changeLock`, `cancelReasonError`); service `markIssueSigned/cancelIssue/restoreIssue/updateIssue` in issue-service.ts; every change writes `fuel_issue_audit` (`changes` = {field: [before, after]}) shown under ประวัติการแก้ไข.
- A slip in a closed cycle or a cancelled one can't be edited/signed/cancelled (`changeLock`). Edit re-prices every line with the price of the slip date.
- List: filters machine + status, 50 per page, `GET /issues/export` (Excel, same filters).
- (book, doc) stays unique even for cancelled slips (DB unique index) — restoring is refused if the number was keyed again meanwhile.
- e2e: `issues.spec.ts` "changing a saved slip".

## Claim cycles + invoices (22 Nov 2026)
- Cycle = calendar month (BA). `cycleIdFor(tx, date)` (server/cycles/cycle-service.ts) finds the cycle covering a date or makes the month's; createIssue/updateIssue use it, so every slip has a cycle. Existing DBs: slips saved before this have `claim_cycle_id` NULL (not shown in any invoice) — run a one-off backfill if real data exists.
- Pure rules in `domain/cycle.ts`: `planClose` (signed → invoice, unsigned → carried to next cycle keeping date+price, cancelled ignored), `reopenReasonError`, `INVOICE_FLOW`/`nextInvoiceStatus`. Tests: cycle.test.ts.
- `/invoices?cycle=` list (per project: signed slips, liters, baht, status; unsigned warning per row; explanatory line vs monthly), `CyclePanel` (close: any writer; reopen: system_admin + reason, invoices back to draft, history in `cycle_events`), `/invoices/[cycle]/[project]` (sheet per design 6.10, status stepper one step forward after close, total-row code editable while draft, print), `/invoices/[cycle]/print` (all projects, one per page). PDF = browser print → save as PDF.
- A carried slip keeps its old date: editing it without moving the date skips the "date is in a closed cycle" check (`loadIssueContext` `sameDateAsSaved`) and keeps its cycle.
- Reopen does NOT move carried slips back (they stay in the next cycle; sign them there).
- Overview/monthly still pick by month (= cycle while cycles are calendar months).
- e2e: `invoices.spec.ts`. No schema change.

## Settings (22 Nov 2026, design 6.11) — system_admin only
- `/settings/layout.tsx`: non-admins get a "ไม่มีสิทธิ์เข้าหน้านี้" page (no redirect); tabs `/settings/{projects,machines,users,cycles,tank}`, `loading.tsx` for the waiting state, errors fall to `app/error.tsx`.
- projects: read-only list from BookCare's table, search as you type (design 6.11, no open/closed filter). machines: add/edit (code unique by `machineKey`, rented has no asset code). users: add (one-time initial password, ≥ 8), edit name/role/projects, reset password (typed by admin), deactivate/activate with confirm; can't close own account or the last active admin; every problem shown at once (`validateUser`). cycles: list incl. the next auto-made cycle; edit end date of an open cycle (start follows the previous one; next cycle's start shifts; refused when slips dated in the moved days exist or the next cycle is closed). tank: capacity, low mark (liters; empty = 20%), opening balance + date (locked after the first cycle is closed).
- Rules `domain/settings-rules.ts` (+test); service `server/settings/settings-service.ts`; actions `settings/actions.ts` (all `requireAdministrator`, inputs re-parsed).
- e2e: `settings.spec.ts`.

## Leftovers (22 Nov 2026)
- **Price edited later** (`purchase-service.repriceOpenLines`): a new/changed daily price re-prices slips of that day onward whose claim cycle is still open (waiting ones get a price, ones on the old fallback price move). Closed cycles are never touched. Toast says how many (`repriceWarnings`); pure rule = `domain/reprice.ts`.
- **Ledger note**: table `ledger_notes` (one per day), edited inline in the หมายเหตุ column (`ledger/note-input.tsx`, saves on blur/Enter), shown read-only to non-writers, filled in the Excel export.
- **Bill photo**: optional on a purchase; the browser shrinks it to ≤1280 px JPEG, stored as bytea in `purchase_bill_photos`, served by `GET /api/purchase-photo/[id]` (needs access to /purchases).
- Book/doc inputs select their text on focus (OBS-04).
- **Neon: run `scripts/sql/2026-11-22-notes-and-bill-photos.sql` before deploying** (branch backup first, ask the owner). Local: `npm run db:push`.
- e2e: `e2e/leftovers.spec.ts`.
- **Mockup data for demos** (local only): `npm run db:mockup` = `db:seed` + `src/db/mockup.ts` (about 5 weeks of purchases and slips through the real services, last month closed with slips carried, cancelled/unsigned/waiting-for-price slips, notes, one tank check). Dates are relative to today. Never on Neon. e2e still starts from the empty `db:seed`.

## BA rulings of 22 Nov 2026 (sheet "MYOIL: คำตัดสิน BA จากผลทดสอบ")
- **OBS-01**: a saved slip that makes the balance negative says so on its page (warning + "check that purchases are all keyed"); it still saves.
- **OBS-04**: a plain `/issues/new` is empty; book + next doc no. are filled only after "บันทึกและคีย์ใบถัดไป".
- **OBS-11**: slip history shows old → new for date, project (code) and the machine/liters list.
- **OBS-13**: a signed slip with no price is not "อยู่ในใบแจ้งแล้ว" and **blocks closing the cycle** (message: set the day price first). Never carried on.
- **OBS-17**: `purchaseOddities()` (domain/purchase-calc.ts) — price >20% from the latest daily price, liters over the tank capacity (once set), liters <100 → the form asks "ยืนยันบันทึก"; server returns `confirm: string[]`, resend with `confirmed`. Numbers are BA proposals.
- **OBS-18**: purchases can be edited / cancelled (reason) / restored, never deleted; locked when the cycle covering the date is closed. Columns `fuel_purchases.cancelled_*`, table `purchase_audit`; cancelled purchases count nowhere (ledger, totals). Editing a purchase does not change the shared daily price (it says so). **Neon: `scripts/sql/2026-11-22-purchase-changes.sql` before deploy.**
- Already done before: OBS-02/10 (2 decimals refused, price valid from its date), Brief 10/11/12 texts. e2e: `e2e/ba-rulings.spec.ts`.

## Photo of the signed slip (23 Nov 2026, owner: urgent)
- Table `issue_signed_photos` (one per slip, bytea in the DB like the purchase bill photo; `schema.ts`). **Neon: `scripts/sql/2026-11-23-issue-signed-photos.sql` before deploying** (backup branch first, ask). Local: `npm run db:push`.
- New slip form: optional "รูปใบเซ็น" → `saveIssueAction(input, photo)`; if only the photo fails the slip is saved and the detail page opens with `?photo=failed` and a message. Slip page: `SignedPhotoCard` (look, แนบ/เปลี่ยน, ลบ with a confirm) for writers; same locks as any change (cancelled / closed cycle). Every attach/replace/remove is in the history (`photo: มีรูป → เปลี่ยนรูปแล้ว`).
- Browser shrinks to ≤ 1280 px JPEG (`lib/image-shrink.ts`, shared with the purchase bill); server re-checks the bytes (`server/issues/slip-photo.ts`: JPEG/PNG magic, ≤ 1 MB). Served by `GET /api/issue-photo/[id]` (roles that open /issues, only projects they may see).
- Not here: several photos per slip (the old `fuel_issue_photos` stays for meter photos, stage 2).
- Tests: `slip-photo.test.ts`, `e2e/issues.spec.ts` (attach · replace · remove · not-a-picture).

## Stage 2 — BookCare link, MYOIL side (24 Nov 2026)
Contract = "สัญญา API BookCare ↔ MYOIL" (design doc). BookCare's server calls MYOIL; MYOIL only calls BookCare for the project list.
- **Auth**: `Authorization: Bearer $BOOKCARE_PUSH_KEY` on every `/api/bookcare/v1/*` call (`server/bookcare/http.ts`, constant-time, a missing/short key rejects everything). Keys live in `.env` and Vercel only. MYOIL → BookCare (API 7) uses `BOOKCARE_API_URL` + `BOOKCARE_PULL_KEY`. `CRON_SECRET` guards the cron route.
- **API 1–3** (`POST issues`, `purchases`, `issues/{ref}/signature`): checks are pure in `domain/bookcare-api.ts` (numbers are text, > 2 decimals refused, 1–10 lines, a meter photo on every line, signature XOR reason, a signature always has the receiver's name); writing is `server/bookcare/receive-service.ts`. Same `ref` + same content → 200 `duplicate:true`; same `ref` + other content → 409 `ref_conflict` (`request_hash` = sha256 of the content without image bytes). Everything runs under a Postgres advisory lock, so two sends of one ref can't make two slips.
- **Slip numbers**: book `M<Buddhist year 2 digits><month>` (`M6911`), doc no. = 4-digit running number (`0001`), a new book every month by the slip's date (`appBookNo`/`appDocNo` in `domain/bookcare-api.ts`). Paper books are digits only, so they can't clash.
- **Answers as the contract writes them** (checked against the Doc, 23 Nov): API 1 → `issueId`, API 2 → `purchaseId` (no `ref`/`id`); API 5 has `asOf` (+07:00) and `today {issues, litersOut}`; API 6 has `signedLate` (= signed through API 3: `signature_ref` set); API 4 `maxLiters` is null with fewer than `MIN_FILLS_FOR_MAX` (3) fills in 90 days. API 1 keeps `timeIn`/`timeOut` (HH:MM, optional) in `fuel_issues.time_in/time_out`.
- **Flags, not errors, for office rules**: `late` (date's cycle is closed → slip goes to the first open cycle), `over_balance`, `new_machine:<pos>`; purchases get `price_far_from_daily` / `over_capacity` / `small_purchase`. Prices come from the daily price of the slip date (no price → "รอราคา"). A purchase from the phone is `pending_confirm` (liters count in the tank at once; it does NOT touch the daily price).
- **Machines typed on the phone** that match nothing are created with `machines.pending_review` ("รอตรวจชื่อ"): they are not listed in API 4. The slip's page offers "รวมกับเครื่องเดิม" (moves every line, deletes the held name) or "รับเป็นเครื่องใหม่"; "ตรวจแล้ว" is refused while a name is held.
- **Review** (`server/issues/review-service.ts`, card `issues/[id]/review-card.tsx`): `fuel_issues.review_status` pending_review → checked. Checking = meter photo vs liters; a late signature never changes the status (BA). Only `checked` + signed slips are invoiced (`countsInInvoice`, `billableSql` in closeCycle / cycle view / overview). Pending ones are carried like unsigned ones, and the invoices page says so ("ตรวจก่อนปิดรอบ"). Editing lines of a signed phone slip sets `edited_after_sign` ("แก้หลังเซ็นรับ"); **`updateIssue` keeps the meter photos by line position** (the lines are deleted and re-inserted).
- **API 4–6**: machines (90-day window, `projects`, `maxLiters`, `lastFilledAt`, ETag/304), tank (= `stockOn(today)`, `includedRefs` = phone refs of the last 7 days), status (≤ 50 refs, no prices). The 1.5× "high liters" warning is computed on the phone; BA: review the multiplier after the first month of paper + phone side by side.
- **API 7**: `server/projects/bookcare-api-source.ts` (`BookcareApiProjectSource`, answers `{projects:[…]}` or a bare array, refuses an empty list) → `syncProjects()`. Daily Vercel Cron (`vercel.json` → `/api/cron/sync-projects`, 20:00 UTC) and once (throttled to 1/min) when API 1 meets an unknown `projectRefCode`. No sync button.
- **Neon**: `scripts/sql/2026-11-24-mobile-issues.sql` (plus the 2 earlier pending files and `2026-11-23-issue-signed-photos.sql`) BEFORE deploying; backup branch first, ask the owner. The "BookCare" user (`bookcare@system.invalid`, inactive, password `!`) owns `recorded_by` of phone slips; it is created on first use if the SQL didn't.
- **Tests**: `domain/bookcare-api.test.ts`, `bookcare-flags.test.ts`, `rules.test.ts`, `projects/bookcare-api-source.test.ts`; e2e `bookcare-api.spec.ts` (needs a dev server started by Playwright: it carries `TEST_PUSH_KEY`), `mobile-review.spec.ts`.
- Phone purchases: `confirmPurchase()` (button "ยืนยัน" on /purchases; "แก้ไข" first if the bill was misread) makes the bill price the day price and re-prices waiting slips, like keying a purchase.
- Not done yet: shared JSON fixture files with BookCare (requests are built in the specs), overview badge for slips waiting for a check, project × machine report.

## Route of the fuel truck (23 Nov 2026, owner — supersedes "the driver picks the project")
Brief R20–R23 + §8 "วางเส้นทางรถเติมน้ำมัน", contract §9.1 (API 8, API 9, `routeStopId` on API 1). Owner: one route per day (one truck), one slip per stop, MYOIL refuses a phone slip without a stop.
- Tables `fuel_routes` (one per `route_date`) and `fuel_route_stops` (position, project, note, `issue_id`, skip fields); `fuel_issues.route_stop_id`. **Neon: `scripts/sql/2026-11-24-fuel-routes.sql` after `2026-11-24-mobile-issues.sql`, before deploying** (backup branch first, ask). Local: `npm run db:push`.
- Status is derived, never stored (`domain/route.ts` `stopStatus`): a slip that isn't cancelled = `filled` (wins over a skip), `skip_ref` set = `skipped`, else `pending`. Cancelling the slip reopens its stop. Only `filled` stops are locked (`canChangeStop`).
- Page `/routes` (nav "เส้นทางรถเติมน้ำมัน": store_admin, system_admin plan; executive reads): pick a day, add a project as a stop with a note, ↑/↓, remove, "คัดลอกจากวันก่อน" (only into an empty day), status of each stop (filled → link to the slip, skipped → reason · time · driver). Plain server-action forms (`routes/actions.ts`), messages via `?msg=` / `?err=`. Service: `server/routes/route-service.ts`.
- API 8 `GET /api/bookcare/v1/route?date=` (no route = 200 `stops: []`). API 9 `POST /api/bookcare/v1/route/stops/{id}/skip` (`checkSkipRequest`; same `skipRef` = duplicate; filled → 409 `stop_filled`; unknown → 404). API 1: `stopForIssue` + `checkStopForIssue` inside the slip's transaction (row locked): no/unknown stop → 400 `no_route_stop`, other project/day → 400 `invalid` (`routeStopId`), filled → 409 `stop_filled`, skipped → accepted with flag `was_skipped`; `fillStop` links the slip to the stop.
- Tests: `domain/route.test.ts`; e2e `routes.spec.ts` (plan 3, fill 1, skip 1, remove, copy), `bookcare-api.spec.ts` "API 8 + 1 + 9". Every phone slip in the e2e specs gets its own stop through `planStop()` (`e2e/helpers.ts` → `scripts/e2e-plan-route.ts`, local DB only).

## Tab titles + app icon (23 Nov 2026)
- Root layout: `title.template "%s · MYOIL"`; every page.tsx exports `metadata.title` (names from the side menu).
- Icon = the sidebar mark (pill with a fuel wave) on earth brown: `src/app/icon.svg` + `src/app/apple-icon.png` (Next file convention, no public/ folder).

## UI = design canvas "MYOIL — โครงหน้าจอ 11 หน้า (ขั้นที่ 1)" (24 Nov 2026, owner: make it look like the design)
Canvas: https://claude.ai/artifact/Uqo1UKbTFKvFesTbZXVFBG (6.1–6.11, States, Check, FillReport). Read the artboard before changing a screen.
- Blocks in `components/ui.tsx`: `PageHeader` (back link · 34px title · sub · actions), `Card`, `CardTitle`, `Button`/`linkButton` (primary = yellow, one per page · secondary · ghost · danger · dangerOutline; disabled = grey), `Pill` ok/wait/bad/off (dot + word), `ProjectChip`, `Field` (label above; red error, brown warning, hint), `fieldClass`/`fieldBadClass`, `Alert`, `Notice`, `StateBox` (empty / failed / no access), `SkeletonRows`, `Kbd`. A box on a page that says what to check = white, 12px corners, red border (`border-repair`); plain info = `border-line`.
- `components/filter-form.tsx` (dropdowns/dates apply at once, text on Enter; `search={false}` for a chooser), `pager.tsx` (20/50/100), `toast.tsx` (dark, bottom right, 5 s, role=status — key it by a counter so each success shows anew), `dialog.tsx` `ConfirmDialog` (native modal `<dialog>`, children render only while open; keep a `<section aria-label>` inside — e2e finds the window by that region).
- Everything that asks first is a `ConfirmDialog`: cancel/sign a slip, close/reopen a cycle, reset password, close/open an account. Success = `Toast` with the button's verb. History lines use `formatStamp()` (`lib/format.ts`, "22/11/69 09:15" Bangkok).
- Invoices 6.9: the cycle is picked in the header box "รอบเคลม" (option "(รอบนี้)"); open = [รอบ][พิมพ์ทั้งหมด][ปิดรอบ X], closed = [รอบ][เปิดรอบอีกครั้ง][พิมพ์ทั้งหมด]. `CyclePanel` lives in the header under `key="panel"` so its message survives the page flipping state. The line under the table compares with the monthly table when the cycle is one calendar month (`loadMonthly`), else with all slips of the cycle.
- Invoice 6.10: "ดาวน์โหลด PDF" = print window with the file name taken from a temporary page title (no PDF library; installs are blocked); the sheet prints the accounting code after the ref and "ผู้จัดทำ" = who closed the cycle + the day.
- Settings 6.11: every tab draws `settings/settings-header.tsx` (title + tabs + the tab's one button: "เพิ่มเครื่องจักร", "เพิ่มผู้ใช้"); the layout is only the admin gate. Add/edit forms sit beside the list (`flex-[999_1_560px]` + `flex-[1_1_340px]`, wrap below). Projects and machines filter as you type.
- Kept on purpose although the canvas doesn't show it: menu "เส้นทางรถเติมน้ำมัน" (owner), BA wording ("สรุปเดือน", "มูลค่าน้ำมันที่จ่ายออก", "…และถูกยกไปรอบถัดไป"), "แก้ไข" on a user row, the history cards, the edit/cancel buttons on purchases.
- Open (needs data from the owner): the issuer's address/phone line and the yard manager's name on the printed invoice (canvas placeholders); the canvas itself says the sheet is not yet checked against the real paper form.

## Test round 10 fixes (24 Nov 2026, sheet "MYOIL — ผลทดสอบรวม รอบ 1–5")
- BUG-05: the overview counts this month up to today (`monthUpTo`, domain/iso-date.ts), like the balance book; the "ใบจ่าย" card opens `/issues?from=<1st>&to=<today>`. A slip dated later (a phone whose clock runs ahead) counts from its own date.
- OBS-25: a phone slip dated after the Bangkok day it reached MYOIL gets the flag `dated_ahead` (`withDateFlags`, domain/bookcare-flags.ts), added when the check page and the slip's review card read it: tag "ลงวันที่ล่วงหน้า" + a line telling the checker to fix the date with the driver. Not stored, not refused, not sent to BookCare. Refusing such slips in API 1 would change the contract — ask the owner and BookCare first.
- e2e: overview.spec "BUG-05", mobile-review.spec "OBS-25". Unit: iso-date.test (`monthUpTo`), bookcare-flags.test (`withDateFlags`).
- Two older specs followed the new screens: mobile-review looks for "รอตรวจ" in the slip's row (the side menu carries a hidden "ใบรอตรวจ"), settings expects "บัญชีนี้ถูกปิดการใช้งาน" for a closed account signing in with the right password (design 6.1).

## Fuel-truck driver moves into MYOIL (owner, 25 Nov 2026) — stage 1 of 4
Owner: the fuel work leaves BookCare completely. The driver signs in to MYOIL, the screens look like BookCare's
(design https://claude.ai/artifact/2N4LwyuGCDCRogY9Tze8HZ); daily work of the truck (mileage, 4-side photos, GPS) and the
office map page come here too; BookCare keeps vehicles + transport jobs only. Not moved (cut): ratings, transport jobs, job history, cleanliness photos.
Plan: 1 driver login (this) · 2 the six driver screens + camera + offline queue, writing through `receive-service` in-process (no HTTP between the apps) · 3 mileage / 4-side photos / GPS + office map · 4 remove fuel from BookCare.
- **Role `driver`** (`roleEnum`, `Role`, label "คนขับรถเติมน้ำมัน"), `users.phone` (unique), `failed_logins`, `locked_until`. A driver's email is `<phone>@driver.invalid`; the PIN hash sits in `password_hash`. **Neon: `scripts/sql/2026-11-25-drivers.sql` before deploying** (backup branch first, ask). Local: `npm run db:push`.
- **Login** `/login/driver` (phone + 6-digit PIN; link from `/login`): rules in `domain/driver-login.ts` (+test): 5 wrong PINs → rests 5 minutes; an unknown phone costs the same time. The email login refuses drivers.
- **Gates**: `requireDriver()`; `(app)/layout` sends a driver to `/driver`; `/issues/export` now checks `canOpen` like the other exports. `listUsers()` (settings › users) leaves drivers out — no screen to add/edit a driver yet (seed only).
- **Screens** (stage 1, read-only): `/driver` (tank with bar, next stop + admin note + "นำทางไป …" = Maps search by project name, today's route with status), `/driver/account` (logout). Pieces in `components/driver/` (`bits.tsx`, `driver-shell.tsx`, `driver-nav.tsx`). The big bottom button is shown but off until stage 2.
- **Demo**: `db:seed` makes 2 trial drivers (phones + PIN printed by the seed); `db:mockup` adds tank capacity 12,000, yesterday's route (2 filled, 1 skipped) and today's route (3 stops with notes).

## Driver screens = design "MYOIL — หน้าจอฝั่ง พขร. (ขั้นที่ 2)" (25 Nov 2026)
https://claude.ai/artifact/CqtRKXSwZD3LZ47BQwRc2D — boards Login, LoginWrong, Main, HomeNoRoute are built; the rest are stage 2.
- `/login/driver`: dark header with `TruckArt` (`components/driver/truck-art.tsx`), phone field + "เปลี่ยน", 6 PIN boxes + on-screen keypad (hidden `pin` input, desktop keys work too). Button off until 6 digits; a refusal remounts the fields (key = `state.at`) so the PIN empties and the phone stays.
- `/driver`: dark tank card (`odometer()` tiles, truck filled by `tankLevel()`, `domain/driver-home.ts`), "วันนี้เติมแล้ว n จาก m จุด" + liters of filled stops (`litersOfIssues()` in route-service), route as a timeline (filled ✓ green + liters + ส่งแล้ว · next = yellow truck, `aria-current="step"` · pending = number · skipped = grey + reason). No route → "วันนี้ยังไม่มีเส้นทาง" + "โหลดเส้นทางอีกครั้ง".
- e2e: `e2e/driver.spec.ts` (`npm run test:e2e:driver`); unit: `domain/driver-home.test.ts`.

## Driver stage 2: the fill flow on the phone (25 Nov 2026, owner: "เริ่มขั้นที่ 2 ทั้งชุด")
Cut list "MYOIL: รายการตัดและลดความซับซ้อน" rows 1–4 approved: the phone talks to MYOIL directly, no BookCare in between.
- **API** `/api/driver/*` (`server/driver/api.ts` `driverPost`): the driver's session cookie instead of the push key, same checks and services as API 1/2/3/9 (`checkIssueRequest` → `receiveIssue`, …). The server overwrites `driver` with the signed-in user. Routes: `issues`, `issues/[ref]/signature`, `purchases`, `stops/[stopId]/skip`, `line-photo/[lineId]` (GET, mobile slips only). `/api/bookcare/v1/*` is still there (cut = stage 4).
- **Camera**: `Permissions-Policy camera=(self)` only on `/driver/*` and `/login/driver` (next.config.ts; login too, because signing in moves to /driver without a new document). `components/driver/camera.tsx`: back camera, no file input; `lib/driver/photo.ts` `capture()` scales to 1024 px, burns day·time·project·machine·driver into the picture, keeps the JPEG ≤ 240 KB (10 lines must fit one 4 MB request). Needs https or localhost.
- **On the phone** (`lib/driver/store.ts`, IndexedDB `myoil-driver`): `drafts` (slip being filled, key = stopId, saved after every change) and `outbox` (finished slips / refills not yet in MYOIL, key = ref). `lib/driver/outbox.ts`: `sendOrKeep()` stores first, then posts; no signal / 5xx / 401 → stays "รอส่ง" and `flush()` retries when the home opens or the signal returns; a 4xx refusal → "ส่งไม่สำเร็จ" with MYOIL's reason, kept until "ลองส่งอีกครั้ง" works. The same `ref` twice = one slip.
- **Screens** (design boards in brackets): `/driver/stop/[stopId]` = one client flow `stop-flow.tsx`: plan + skip sheet [Stop, SkipStop] → fill list [Fill] → machine [Machines; "เคยเติมที่ X" first, search all, new name → held "รอตรวจชื่อ" by the server] → camera [Camera, CameraDenied] → review [Review] → liters keypad + optional hour meter [Liters] → "850 ลิตร ถูกต้องไหม" when > 1.5× the machine's biggest fill [WarnLiters, `isHighLiters`] → summary + finger signature [Sign] or a reason [NoSigner]. `/driver/slip/[id]` = sent slip, ask for the signature later [Detail, DetailWait]. `/driver/refill` [Refill]. Home: `home-route.tsx` (`HomeBanner`, `HomeRoute`, `HomeDock`) merges the server's route with what the phone holds [HomeResume, HomeOffline, HomeFailed].
- Pure rules + request body: `domain/driver-fill.ts` (`typeLiters`, `litersValue`, `isHighLiters`, `issueBody`), tested in `driver-fill.test.ts` against `checkIssueRequest`.
- **Not built yet**: opening the app with no signal at all (no service worker; boards LoginOffline and a cold offline start), the "แอดมินเพิ่มจุดใหม่" banner [HomeChanged], a page for a slip that is still only on the phone (it shows as a row + banner on the home), "หักใบรอส่งแล้ว" on the tank number, a Google Maps button on the stop page, deleting a refused item from the outbox.
- e2e: `e2e/driver-fill.spec.ts` (Chrome's fake camera, set in playwright.config.ts) — `npm run test:e2e:driver`.

## Test rounds 11–12 fixes (25 Nov 2026, sheet "สรุปผลทดสอบ MYOIL รอบ 1–12")
- OBS-27 (office purchase form): a number with a 3rd decimal names its box (`FIELD_NAME` in purchase-calc: "ลิตร ใส่ได้ไม่เกิน 2 ตำแหน่ง…"); text that is not a number ("12a") is refused at that box in `purchase-panel.tsx` instead of counting as empty. The 2-decimal rounding of the computed third value is unchanged (BA).
- OBS-29/30 (driver refill): `money()` lets only digits + one point + 2 decimals into the liters/amount boxes; the dock says what is still missing ("ยังบันทึกไม่ได้ ขาด …"), and the bill photo is labelled "(ต้องมี …)".
- OBS-31 (machine picker): "ไม่พบเครื่องที่ค้นหา" only after a search; an empty list says there are no machines yet; a project never filled before says the list is every machine.
- Not changed, waiting for BA: OBS-26 (reason when editing a purchase), OBS-28 (daily price row after a purchase is cancelled). GAP-12 is covered by `e2e/driver-fill.spec.ts` with Chrome's fake camera, not yet on a real phone.
- Round 13: BUG-06 machine code ≤ `MACHINE_CODE_MAX` (60, `validateMachine` + `maxLength`), refused with the count instead of cut; OBS-32 the "รอคำตอบจากคนให้โจทย์" note is off the cycles page (the question stays in the brief); OBS-33: the page grew as wide as the table because an `sr-only` label (absolute) in the last column escaped the `overflow-x-auto` frame; `.overflow-x-auto { position: relative }` in globals.css holds it. Checked by `e2e/phone-width.spec.ts` (5 office pages at 375 px).
- Round 14: OBS-34 the slip form already disabled its buttons while saving; it now also says "กำลังบันทึก รอสักครู่ ไม่ต้องกดซ้ำ" (role=status, spinner) until the next page shows, and Ctrl+Enter is ignored while a save is on its way. The 2.5–4.5 s itself was measured on the dev server through a tunnel; check on a production build before treating it as slow.

## Driver accounts on ตั้งค่า › ผู้ใช้ (25 Nov 2026, owner: "ทำเลย")
- `DriversCard` (`settings/users/drivers-card.tsx`) under the office users: add (name + mobile), edit, "ตั้ง PIN ใหม่", close/open. `server/settings/driver-service.ts`: the system makes the 6-digit PIN (`randomInt`), stores only its hash and returns it once — shown in a window ("จดแล้ว ปิด"), never again. A new PIN also clears `failed_logins` / `locked_until`. Phone = `normalizePhone` (10 digits from 0), unique; refusals come back per field.
- System administrators only (the settings gate), so the driver screens now say "ติดต่อผู้ดูแลระบบ MYOIL" instead of "แอดมินสโตร์กลาง" for a forgotten PIN. Owner did not choose who manages drivers; least access was taken — open to store admins if asked.
- e2e: last test of `e2e/driver.spec.ts`.

## Driver screens redesign (25 Nov 2026, same canvas, boards Fill · Machines · Sign · NoSigner · Detail · DetailWait changed)
- Every machine row now starts with a small picture: `MachineArt` (`components/driver/machine-art.tsx`, colours = `--color-art-*` tokens) of an excavator, a forklift or a truck. Which one = `machineArt(code, type)` in `domain/driver-fill.ts` (admin's type "รถขุด"/"รถ" first, else the code: FL… forklift, a plate or "รถ…" truck, the rest excavator).
- Fill: 84 px rows = picture 72×64 · name · small meter photo + time · liters · แก้. Machines: search box with a magnifier and brown border, rows with picture + chevron, pill "เติมแล้ว". Sign: plain table with pictures, total as a big plain number, brown borders on the name box and the dashed signature frame (grows with the screen). Detail: number row + pills without a card, one card of lines (picture · meter photo · name · liters), plain total, the receiver's signature picture beside the name (`/api/driver/signature-photo/[issueId]`).

## No daily price list: a slip is priced by its purchase bill (owner, 25 Nov 2026 — cut list row 17) — the "latest bill before the date" rule below is SUPERSEDED by "Price by bill, oldest fuel first" at the end of this file
Owner's answers: the bill = **the latest purchase dated on or before the slip's date** (two that day → the one recorded last); a bill sent from the driver's phone is a price **at once**, before the admin confirms; no real data yet, so nothing old is kept as it was.
- `domain/price.ts` `latestOn()` / `priceOn()` are the rule. `server/prices/price-queries.ts`: `loadBills()` (non-cancelled purchases, oldest first), `billForDate()`, `priceForDate()`. Nothing reads or writes `fuel_prices` any more (table left in the schema; drop later).
- `fuel_issues.price_purchase_id` = the bill a slip draws on (set when a slip is keyed, edited or received from the phone). No bill on or before its date → null and the lines are "รอราคา". **Neon: `scripts/sql/2026-11-25-issue-bill.sql` before deploying** (ask first).
- `repriceOpenLines(tx)` (purchase-service, exported): after a purchase is added, edited, cancelled, restored, confirmed, or received from the phone, every slip of an **open** cycle points at its bill again and its lines take that price (`repriceOpen` + `rebill` in `domain/reprice.ts`); a slip whose only bill went away goes back to "รอราคา". Closed cycles are never touched.
- Gone: `setDailyPrice`, `savePriceAction`, the "ตั้งราคาของวันที่ไม่มีการซื้อ" button, the price-only form and the "ราคาประจำวัน" table on /purchases (a short note explains the rule instead), the "ราคาประจำวันนี้ … ไม่ตรงกับราคาที่ซื้อ" warnings. OBS-28 no longer applies. "Price far from …" now compares with the bill before it.
- Slip page: "รวม ราคา 40.00 บาท/ลิตร ตามบิลซื้อวันที่ 15/01/69 เลขที่ B-001". Slip form with no bill: link "บันทึกการซื้อ".
- Seed: no price row; one bill today, 5,000 liters at 32.50 (`DEMO-0001`), so the demo truck has fuel and today's slips have a price. e2e `recordPurchase()` presses "รับทราบ" when the bill repriced slips.
- A slip dated before the first bill stays "รอราคา" (and blocks closing its cycle) until a bill dated on or before it exists — record the purchase of the fuel that was in the truck at the start.
- Round 15 (login pages): OBS-35 driver phone box = digits only, 10 at most, "เบอร์โทรต้องมี 10 หลัก…" under it, and the dock says why the button is grey (`login-missing`); OBS-36 the driver login dock is no longer sticky (on a short screen it covered the keypad's last row); OBS-37 field messages of `/login` are `role="alert"` (they already had `aria-describedby`), and both login pages show `ADMIN_CONTACT` (name + phone, set in .env / Vercel — still empty) after "ติดต่อผู้ดูแลระบบ".

## Driver login as easy as BookCare's (owner, 25 Nov 2026: "ใช้ง่ายเหมือน bookcare")
Ported from BookCare's `components/login/driver-login.tsx` (same owner's code), under MYOIL's truck header. Supersedes the design board's phone field + "เข้าสู่ระบบ" button and round 15's `login-missing` line.
- One big keypad types everything (no phone keyboard; a computer's number keys + Backspace work). Phone = 10 slots in 3-3-4; the 10th digit moves to the PIN by itself; **the 6th PIN digit logs in, there is no button** (`armed` ref: only after a real key press, never again on a returned error).
- **Remembered phone**: cookie `myoil_last_driver` (`lib/remember.ts`: phone + name, httpOnly, 1 year, never the PIN), set on a successful login. Next time: "สวัสดีครับ คุณ…", masked phone, PIN only; "ไม่ใช่ฉัน ใช้เบอร์อื่น" → `forgetDriver()`.
- One line (`login-message`) always says the next step or the problem; a refused PIN clears itself, shakes the box (`.shake`), keeps the phone. `DriverLoginState.field` sends the cursor back to phone or PIN; `locked` stops the keypad taking a PIN while the account rests.
- Not copied from BookCare: telling "no such phone" from "wrong PIN" — MYOIL keeps one answer for both ("เบอร์โทรหรือรหัส PIN ไม่ถูกต้อง", same time cost).
- "ลืม PIN หรือเข้าไม่ได้" opens the help text with `ADMIN_CONTACT`.
- e2e: `loginDriver()` / `pressDigits()` in helpers.ts; `driver.spec.ts` first two tests.

## Cycle cut day (owner, 25 Nov 2026: "ปิดรอบวันที่ 21 ของทุกเดือน … กดปิด 22 ในระบบต้องตัด 21") — cut list row 8 = NOT cut
- A slip is in a cycle by **its own date** (`cycleIdFor`), never by the day "ปิดรอบ" is pressed; that was already so. New: `app_settings.cycle_cut_day` (1–28, null = end of the calendar month) — ตั้งค่า › รอบเคลม › "วันตัดรอบของทุกเดือน". **Neon: `scripts/sql/2026-11-25-cycle-cut-day.sql` before deploying** (ask first).
- `domain/cycle.ts`: `cycleContaining(date, cut)` (cut 21 → 22 Oct–21 Nov holds 5 Nov), `nextCycleAfter(end, cut)`, `cycleRanges()`, `dayAfter`/`dayBefore`. `cycleIdFor()` makes a missing cycle from the cut day, trimmed against its neighbours. "The next cycle" everywhere = `cycleIdFor(dayAfter(end))` — the old `nextCycleAfter(end).start` was the 1st of that calendar month, which for a cycle ending on the 21st pointed back into the cycle being closed (unsigned slips were "carried" into the closed cycle).
- `saveCutDay()` (settings-service): stores the day, lays the **open** cycles out again from the first open one and moves their slips to the cycle of their date; closed cycles never change; refused when a closed cycle sits after an open one. One cycle's dates can still be changed by hand ("แก้ไข") for a special case.
- Not built: refusing a slip that is keyed after the cut day but dated before it (backdating into a cycle that is still open). Cycle names still come from the month of the start date ("พ.ย. 2569" for 22 Nov–21 Dec).

## Price by bill, oldest fuel first — FIFO (owner, 25 Nov 2026, brief "MYOIL — Brief ฝั่ง พขร." §14 B1–B10)
Replaces "latest bill on or before the slip's date". Every liter issued takes the price of the bill it came from.
- **Rule** = `src/domain/fifo.ts` (`allocateFifo`, pure, `fifo.test.ts`): bills ("lots") and slip lines are walked in time order; a line takes from the oldest lot that has **already arrived** and still has liters, then the next → `Part[]` (`kind` bill | opening | none). A slip crossing two bills = two parts, two prices (B3). Liters nothing covers = `none` = "รอราคา"; they are **not** taken from a later bill (B7: fix liters/date/time at the source, nobody picks a bill by hand, B4).
- **Order**: bill = `purchase_date` + `purchase_time` ("HH:MM", new column; required on the office form, prefilled with now; a phone bill takes the time the driver recorded it). Slip = `issue_date` + `time_in`, else the time the phone recorded it, else "99:99" = a paper slip with no time goes after everything else that day (B9). Same minute: the bill first.
- **Opening stock** = the first lot, at `app_settings.opening_price` (ตั้งค่า › รถเติมน้ำมัน, required when ยอดยกมา > 0, B8). **A phone bill not confirmed yet has liters but no price** (B6): slips drawing on it wait until the admin presses ยืนยัน — this replaces the earlier "ใช้ราคาจากบิลทันที".
- **Stored**: `fuel_issue_line_parts` (line → seq, kind, purchase, liters, price, amount). `fuel_issue_lines.amount` = sum of the parts (null while any part waits); `price_per_liter` = the one price, **null when split** — so "waiting" is always `amount === null`, never `price_per_liter === null`. `fuel_issues.price_purchase_id`, `fuel_prices`, `domain/reprice.ts`, `billForDate`/`priceForDate` are no longer used.
- **Recompute** = `repriceOpenLines(tx)` in `src/server/prices/fifo-service.ts` (advisory lock; all lots + all live lines; slips of a **closed** cycle are frozen: they keep their stored parts and only use up their bills, B5). Called after every change of a bill (create/update/cancel/restore/confirm, phone bill), a slip (create/update/cancel/restore, phone slip), the opening stock, and reopening a cycle. New slip lines are inserted with no money; the reprice sets it.
- **Ask before saving (B5)**: `repriceOrAsk(tx, confirmed, { except })` throws `Ask` when slips that already had their money would get another amount → the transaction is undone and the answer carries `confirm: ["ใบจ่าย n ใบในรอบที่ยังไม่ปิดจะเปลี่ยนยอดเงิน…"]`; the screen shows it and sends again with `confirmed` (purchase panel "ยืนยันบันทึก", purchase row "ยืนยันทำต่อ", slip form "ยืนยันบันทึก", slip cancel/restore: press the same button again). Slips that only get their first price are not asked about. Not asked: phone slips/bills, `correctAndCheck`, tank settings, reopen.
- **Screens**: purchase form "เวลาบนบิล"; slip page "ราคามาจาก" (`data-testid="price-parts"`: liters × price · which bill); slip form shows the split from `previewIssue` (`previewSlip`: the typed slip put in the queue, nothing written); invoice = one row per slip **per price** (`InvoiceLine.part`, B10); สมุดคงเหลือ card "น้ำมันที่เหลือในรถตอนนี้ แยกตามบิลซื้อ" (`stockByBill`, liters + value, `data-testid="stock-by-bill"`); overview says the stock value. The ledger column is now "ราคาบิลล่าสุด" (information only).
- Leftover fuel at cycle close needs nothing: lots are not tied to cycles, so it goes on at its bill's price (B8).
- **Neon before deploy (ask first, backup branch)**: `scripts/sql/2026-11-25-fifo-bill-price.sql`. Local: `npm run db:push`.
- e2e touched: `helpers.ts` (`recordPurchase`/`keyIssue` press "ยืนยันบันทึก" when asked), `purchases.spec.ts` (split over two bills, cancel asks), `issues.spec.ts`, `ba-rulings.spec.ts`, `mobile-review.spec.ts`. **Not run yet.** A bill dated in the past is now used by today's slips too (oldest first), so other specs that record old bills and then check 32.50 amounts may need new numbers.
- Not checked: dataset "DEMO-ราคา" (expected แบบ 2: issued 108,030.00 / billed 98,100.00 / left 1,700 L = 55,070.00) — it is not in the repo.

## Test round 16 fixes — ซื้อน้ำมันเข้า (26 Nov 2026, sheet "MYOIL — ผลทดสอบรวม" rows 99–107, OBS-38…44)
- **Table on a phone (OBS-38)**: the "จัดการ" column is sticky at the right edge (`STICKY` in purchases/page.tsx, soft shadow) and a line under md says the table scrolls; row links are 44px targets. Not turned into cards: two copies of every row would break text locators.
- **Form (OBS-39/40/41)**: on open it scrolls into view and focuses ลิตร; number boxes keep digits, one dot and commas only (`digits`); a message goes away as soon as a value changes; fewer than two of three filled → the empty boxes turn red, the first gets focus, the message names them; ≤ 0 says "ต้องมากกว่า 0"; `data-testid="p-calc"` shows the value the system fills in as soon as two boxes have numbers (it is `aria-live`, **not** role=status: `form.getByRole("status")` must stay the "บันทึกแล้ว" note the e2e helper waits for). The amount box is no longer grey.
- **Time (OBS-42)**: the list says "ไม่มีเวลา" for a bill with none; editing such a bill explains it counts as 00:00 until a time is typed (still optional for old bills). Edit leaves จำนวนเงิน empty on purpose (three filled boxes would refuse a changed liters as "ไม่ตรง"); the p-calc line shows the amount instead.
- **Cancel (OBS-43)**: `ConfirmDialog` with a full-width 16px reason box, red "ยืนยันยกเลิก" far from "ไม่ยกเลิก"; the B5 question and "ยืนยันทำต่อ" appear inside it. The dialog is rendered inside the row's cell, so `row().getBy…` locators still find it.
- **Dates and rules (OBS-44)**: under the date box "ตรงกับ dd/mm/yy ในรายการ" (the browser's own picker cannot show a Thai year); the long grey paragraph is a 3-item list `aria-label="วิธีคิดราคาใบจ่าย"`.
- GAP-15 waits for the owner: may the tester save and cancel test bills on that link.

## Test round 17 fixes — projects: synced from BookCare and managed in MYOIL (26 Nov 2026, sheet rows 108–113: BUG-07, OBS-45…47)
- **ตั้งค่า › โครงการ** (`settings/projects/projects-table.tsx`, admin only): "เพิ่มโครงการ", per row "แก้ไข" and "เปิด/ปิด" (aria-labels `แก้ไขโครงการ REF`, `ปิดโครงการ REF`, `เปิดโครงการ REF`), chips ทั้งหมด / เปิด / ปิด, a red notice when no project is open. Rules = `validateProject` + `projectRef` in `domain/settings-rules.ts` (ref: A–Z, digits, dash, 2–12, stored in capitals, unique whatever the case; name ≤ 150; accounting code optional ≤ 30). Service = `saveProject`, `setProjectActive`; actions revalidate the whole layout (slip form, routes, invoices list projects).
- No delete: slips, routes and invoices point at the project id. A renamed project shows its new code and name everywhere, **closed invoices included** (nothing is snapshotted) — ask the owner if a closed invoice must keep the old name.
- **Sync AND add by hand (owner, 26 Nov 2026: "ต้องการซิงด้วย เพิ่มเองได้ด้วย")**: the daily cron (`vercel.json`) and the API-1 pull stay. `projects.added_locally` marks a project made here; `projects.local_edit_at` is set whenever an admin adds, edits, opens or closes a project here; `syncProjects` then leaves that row's code, name and open/closed alone (only `synced_at` moves) and never closes it for being missing from BookCare. Untouched rows follow BookCare as before; new BookCare projects are added. A hand-made code that BookCare later sends too keeps MYOIL's values. The list shows ที่มา: จาก BookCare / เพิ่มเองใน MYOIL / จาก BookCare แก้ใน MYOIL. No "give it back to BookCare" button yet (set `local_edit_at` to null by hand). **Neon before deploy (ask first, backup branch)**: `scripts/sql/2026-11-26-project-local-edit.sql`. Local: `npm run db:push`. The seed deletes `E2E-%` projects and hands YARD/DEMO1/DEMO2 back to its list.
- `/routes` (OBS-45/46): no open project → the add form is replaced by `data-testid="no-projects"` with a link to ตั้งค่า › โครงการ (admins) or a sentence (others); the picker is no longer `required`, so pressing "เพิ่มจุดเติม" with nothing chosen shows our own "เลือกโครงการก่อน". Wording no longer says "ผ่าน BookCare" (also on the slip page: "มือถือของ พขร.").
- Slip form (OBS-47): `data-testid="project-unknown"` "ไม่พบโครงการ …" as soon as nothing in the list contains what was typed (says where projects are added); no project open at all → said at the box; a refused save scrolls to and focuses the first red box.
- e2e: `settings.spec.ts` "projects: search, add, …". Unit: `settings-rules.test.ts`. Not run yet.

## New test sheet "ผลทดสอบ MYOIL (เริ่มใหม่ 26 พ.ย. 2569)" — https://claude.ai/artifact/RZPBZxBWDDGS4E8sf41WQG (sheet "ผลทดสอบ", read through row 46)
The old sheet is history. Most open rows there were already fixed in code (the tester's link runs an older build). Done on 26 Nov for this sheet:
- **No slip dated in the future (BUG-01, OBS-04; BA)**: `checkIssue` refuses `issueDate > ctx.today` (`FUTURE_DATE`; server gives Bangkok today in `loadIssueContext`, the form gives its own and sets `max` on the date box). Editing a phone slip that is dated ahead is refused until the date is put right.
- **A phone slip dated after the day it arrived counts nowhere** until its date is fixed: `datedAheadSql` / `countsSql` in `server/issues/billable.ts` (not cancelled AND not dated ahead) is used by the ledger (`issuesByDay`, `stockOn`), monthly table, overview, machine report and the price queue (`fifo-service` `loadLines`). `markChecked` refuses it, so it cannot reach an invoice. Not changed: the driver's own tank on the phone (`read-service`), the slip list (it still shows the slip, flagged).
- **A changed purchase bill needs a reason (OBS-05; BA)**: `PurchaseInput.reason`, required by `updatePurchase` when something changed, kept in `purchase_audit.changes.reason`; the edit panel has "เหตุผลที่แก้ไข" (`#p-why`).
- **ตั้งค่า › โครงการ (OBS-22)**: three short lines under the table, 44px row buttons, closing asks first (`ConfirmDialog`, "ปิดโครงการนี้"); opening does not ask.
- **Clean test data (GAP-07, DATA-01/02; owner "ล้างเลย")**: `npm run db:seed` now also deletes projects named `E2E-%` / `TEST%` and every project added by hand; `SEED_NO_PROJECTS=1 npm run db:seed` leaves no project at all (to test the empty states). Local / test database only — the seed refuses production and must never run on Neon.
- e2e: `overview.spec.ts` (future date refused, replaces the BUG-05 test that keyed a future slip), `ba-rulings.spec.ts` (edit needs a reason), `settings.spec.ts` (close asks first), `issues.spec.ts` (price shown while typing). Unit: `issue-check.test.ts`, `parse-input.test.ts`. Not run yet.
- Still open on that sheet and not code: OBS-01 "dev mode" (the tester's link is `next dev`), OBS-02 admin contact (`ADMIN_CONTACT` env is empty), OBS-03, GAP-01/03/04/06.
- **A new purchase bill needs its photo, on the office form too (owner, 26 Nov 2026: "แก้ต่อเลย" after PASS-14's note)**: `createPurchase` refuses without `billPhoto` (`PHOTO_NEEDED`, field `photo`); only demo scripts pass `{ photoOptional: true }` (`db/mockup.ts`). The panel says "รูปบิล (ต้องแนบ)" and stops before sending. Editing a saved bill still cannot change its photo. e2e: `attachBill(form)` in `helpers.ts` (used by `recordPurchase` and every spec that fills the form itself); `purchases.spec.ts` "a new bill needs its photo…".
- Also from that sheet: the third number box of the purchase form now shows the worked-out value in the box itself (`shown()`; what is sent is still only what was typed), and the closed-cycle note on a slip page appears once (not again in the photo card).

## One command to check everything: `npm run check` (26 Nov 2026, owner: "รันเทสไม่ไหว")
`scripts/check-all.sh`: local Postgres up → `drizzle-kit push --force` → `npm test` → every Playwright spec, without stopping at the first failure. It refuses to run unless `DATABASE_URL` in `.env` is localhost (the specs wipe fuel data; `--force` is for the local database only — never Neon). Results in `.check/` (git-ignored): `summary.txt`, `unit.log`, `e2e.log`, `e2e.json`, `db.log`; failure details stay in `test-results/`. The owner runs this one line and says "รันเสร็จแล้ว"; the developer reads `.check/` and `test-results/` on the device. **`npm run check` runs only the specs listed in `scripts/check-changed.txt`** (owner: "เฉพาะที่พึ่งแก้") — rewrite that list with every round of changes; `npm run check:all` runs every spec; `npm run check -- e2e/x.spec.ts` runs the ones named.

## Driver's phone names the site, not just its code (OBS-23, 26 Nov 2026: owner from real use — "แก้ฝั่งคนขับหน่อย")
- `siteName(name, code)` in `domain/driver-fill.ts` = the project's name without the leading "โครงการ" (falls back to the code). On the phone the **name is the big line**, the code a small tag beside it, and `projects.site_detail` (address / district / landmark) under it: today's route list (`home-route.tsx`), the stop's first screen (`data-testid="stop-name"`; `stop-code` is now the yellow tag), the sign screen the receiver reads, the slip page (`data-testid="slip-site"`), and one more line printed under the signature picture. Buttons and sheet titles keep the short code ("ทำต่อที่ DEMO1", "ข้าม DEMO2 เพราะอะไร").
- `projects.site_detail` (≤ 200, `PROJECT_DETAIL_MAX`) is typed on ตั้งค่า › โครงการ ("ที่ตั้งไซต์ สำหรับ พขร."); the list and the admin's route page say "ยังไม่ใส่ที่ตั้งไซต์" when it is empty. It is MYOIL's own field: the BookCare sync never touches it, and typing only it does not set `local_edit_at` (code and name still follow BookCare). Column added by `scripts/sql/2026-11-26-project-local-edit.sql`. The seed gives DEMO1/DEMO2 an address.
- Not done (waits for Ploy's design, as the tester's row says): a map / "นำทาง" button, a photo of the site entrance.

## Machines can be deleted (owner, 26 Nov 2026: "ต้องสามารถลบเครื่องจักรได้")
- ตั้งค่า › เครื่องจักร: each row has "ลบ" (aria-label `ลบเครื่องจักร CODE`) → `ConfirmDialog` that first asks the server how many slips name the machine (`machineUseAction`) and says what will happen. `deleteMachine()` in settings-service: **no slip ever used it → the row is deleted**; **used (cancelled slips count) → `machines.deleted_at` is set**: gone from the settings list, the slip form's datalist (`machineOptions`), the phone's list (`machinesForPhone`) and the "merge into" list of the check desk, while slips, the machine report and invoices that already name it keep showing it.
- Coming back: adding the same code on ตั้งค่า › เครื่องจักร, typing it on an office slip (`resolveMachines`) or a phone slip naming it (`receiveIssue`) clears `deleted_at` — same machine, same history. Editing another machine to a deleted machine's code is refused with a sentence that says so.
- **Neon before deploy (ask first, backup branch)**: `scripts/sql/2026-11-26-machine-delete.sql`. Local: `npm run db:push`.
- e2e: `settings.spec.ts` (delete an unused machine; a used one is hidden, its slip keeps it, adding the code again brings it back). Not run yet.
