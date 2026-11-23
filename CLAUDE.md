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
- `projects` is a **read-only mirror** of BookCare's list. Only `server/projects/sync-projects.ts` writes it. No add/edit project UI. How BookCare data arrives is open → `ProjectSource` port, adapter still to write.
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
- projects: read-only list from BookCare's table, search + open/closed filter. machines: add/edit (code unique by `machineKey`, rented has no asset code). users: add (one-time initial password, ≥ 8), edit name/role/projects, reset password (typed by admin), deactivate/activate with confirm; can't close own account or the last active admin; every problem shown at once (`validateUser`). cycles: list incl. the next auto-made cycle; edit end date of an open cycle (start follows the previous one; next cycle's start shifts; refused when slips dated in the moved days exist or the next cycle is closed). tank: capacity, low mark (liters; empty = 20%), opening balance + date (locked after the first cycle is closed).
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
