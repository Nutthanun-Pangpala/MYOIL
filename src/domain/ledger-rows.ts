import { buildLedger } from "./ledger";
import { sumAmounts, sumLiters } from "./money";
import { priceOn, type DailyPrice } from "./price";
import { stockDifference } from "./ledger";

/** One screen row of สมุดคงเหลือ (brief §6.7). Pure: the service only fetches the numbers. */
export type LedgerRow = {
  date: string;
  /** money paid for fuel bought that day; null = no purchase */
  purchaseAmount: number | null;
  /** the day's price per liter (latest price on or before the day); null = none yet */
  price: number | null;
  in: number;
  out: number;
  closing: number;
  negative: boolean;
  /** what the admin measured in the truck that day (optional) */
  measured: number | null;
  /** measured − book; null when nothing was measured */
  diff: number | null;
};

export function ledgerRows(args: {
  openingLiters: number;
  from: string;
  to: string;
  purchases: readonly { date: string; liters: number; amount: number }[];
  issues: readonly { date: string; liters: number }[];
  prices: readonly DailyPrice[];
  checks: readonly { date: string; liters: number }[];
}): LedgerRow[] {
  const days = buildLedger({
    openingLiters: args.openingLiters,
    from: args.from,
    to: args.to,
    purchases: args.purchases,
    issues: args.issues,
  });
  const measuredBy = new Map(args.checks.map((c) => [c.date, c.liters]));
  return days.map((d) => {
    const bought = args.purchases.filter((p) => p.date === d.date);
    const measured = measuredBy.get(d.date) ?? null;
    return {
      date: d.date,
      purchaseAmount: bought.length ? sumAmounts(bought.map((p) => p.amount)) : null,
      price: priceOn(args.prices, d.date),
      in: d.in,
      out: d.out,
      closing: d.closing,
      negative: d.negative,
      measured,
      diff: measured === null ? null : stockDifference(d.closing, measured),
    };
  });
}

/** the four numbers on top of the screen, and the footer row */
export function ledgerSummary(rows: readonly LedgerRow[]) {
  if (rows.length === 0) return { opening: 0, in: 0, out: 0, closing: 0, amount: 0 };
  const first = rows[0];
  return {
    opening: sumLiters([first.closing, -first.in, first.out]), // opening of the first day
    in: sumLiters(rows.map((r) => r.in)),
    out: sumLiters(rows.map((r) => r.out)),
    closing: rows[rows.length - 1].closing,
    amount: sumAmounts(rows.map((r) => r.purchaseAmount ?? 0)),
  };
}
