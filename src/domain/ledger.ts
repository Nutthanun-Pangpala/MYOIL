import { addDays } from "./iso-date";
import { sumLiters } from "./money";

/** สมุดคงเหลือ: opening + purchases in − issues out, per day. Negative is allowed (warn, never block). */

export type Movement = { date: string; liters: number };

export type LedgerDay = {
  date: string;
  opening: number;
  in: number;
  out: number;
  closing: number;
  negative: boolean;
};

/**
 * One row for every date from `from` to `to` (inclusive).
 * `purchases` = fuel bought into the truck, `issues` = fuel issued out to projects
 * (the caller passes only issues that count in the balance — see rules.ts).
 */
export function buildLedger(args: {
  openingLiters: number;
  from: string;
  to: string;
  purchases: readonly Movement[];
  issues: readonly Movement[];
}): LedgerDay[] {
  const { from, to } = args;
  if (from > to) return [];

  const inBy = new Map<string, number[]>();
  const outBy = new Map<string, number[]>();
  for (const p of args.purchases) (inBy.get(p.date) ?? inBy.set(p.date, []).get(p.date)!).push(p.liters);
  for (const i of args.issues) (outBy.get(i.date) ?? outBy.set(i.date, []).get(i.date)!).push(i.liters);

  const rows: LedgerDay[] = [];
  let opening = args.openingLiters;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const liIn = sumLiters(inBy.get(d) ?? []);
    const liOut = sumLiters(outBy.get(d) ?? []);
    const closing = sumLiters([opening, liIn, -liOut]);
    rows.push({ date: d, opening, in: liIn, out: liOut, closing, negative: closing < 0 });
    opening = closing;
  }
  return rows;
}

/** difference between what the book says and what the admin measured (measured − book) */
export function stockDifference(bookLiters: number, measuredLiters: number): number {
  return sumLiters([measuredLiters, -bookLiters]);
}
