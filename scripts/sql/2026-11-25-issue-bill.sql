-- 25 Nov 2026 (owner): no daily price list. A slip takes its price from the latest purchase bill on or before its date.
-- Run on Neon BEFORE deploying this version (backup branch first). Safe to run twice.
alter table fuel_issues add column if not exists price_purchase_id uuid references fuel_purchases(id) on delete set null;

-- point every slip at its bill (latest non-cancelled purchase on or before the slip's date; of two that day, the one recorded last)
update fuel_issues i
   set price_purchase_id = (
     select p.id from fuel_purchases p
      where p.cancelled_at is null and p.purchase_date <= i.issue_date
      order by p.purchase_date desc, p.created_at desc
      limit 1)
 where i.price_purchase_id is null;

-- fuel_prices is no longer read or written by the app; it is left in place (drop it later, once nothing needs the old numbers).
