/**
 * ตารางรายเดือน maths. Pure. Rows come from every issue line that counts (rules.ts countsInMonthly);
 * 0 on a day means nothing was issued (the screen shows "–").
 */
import { monthRange } from "./iso-date";
import { sumLiters } from "./money";

export type MonthlyLine = {
  date: string;
  projectKey: string;
  projectLabel: string;
  machineKey: string;
  machineLabel: string;
  assetCode: string | null;
  isRented: boolean;
  liters: number;
};

export type MatrixRow = { key: string; label: string; days: number[]; total: number };
export type MachineRow = MatrixRow & { no: number; assetCode: string | null; isRented: boolean };
export type Matrix<R> = { days: number; rows: R[]; dayTotals: number[]; grandTotal: number };

export const daysIn = (month: string) => Number(monthRange(month).end.slice(8));

/** Latin codes first, then Thai (as in the design: PCOB before ตย.02) */
const th = new Intl.Collator("en");

function fill<K extends { key: string; label: string }>(lines: MonthlyLine[], month: string, keyOf: (l: MonthlyLine) => K) {
  const n = daysIn(month);
  const { start, end } = monthRange(month);
  const groups = new Map<string, { k: K; perDay: number[][] }>();
  for (const l of lines) {
    if (l.date < start || l.date > end) continue;
    const k = keyOf(l);
    const g = groups.get(k.key) ?? { k, perDay: Array.from({ length: n }, () => [] as number[]) };
    g.perDay[Number(l.date.slice(8)) - 1].push(l.liters);
    groups.set(k.key, g);
  }
  const rows = [...groups.values()]
    .map(({ k, perDay }) => {
      const days = perDay.map(sumLiters);
      return { ...k, days, total: sumLiters(days) };
    })
    .sort((a, b) => th.compare(a.label, b.label));
  const dayTotals = Array.from({ length: n }, (_, i) => sumLiters(rows.map((r) => r.days[i])));
  return { days: n, rows, dayTotals, grandTotal: sumLiters(dayTotals) };
}

/** every project × day */
export function byProject(lines: MonthlyLine[], month: string): Matrix<MatrixRow> {
  return fill(lines, month, (l) => ({ key: l.projectKey, label: l.projectLabel }));
}

/** one project: machine × day, numbered in the order shown */
export function byMachine(lines: MonthlyLine[], projectKey: string, month: string): Matrix<MachineRow> {
  const meta = new Map<string, { assetCode: string | null; isRented: boolean }>();
  const mine = lines.filter((l) => l.projectKey === projectKey);
  for (const l of mine) if (!meta.has(l.machineKey)) meta.set(l.machineKey, { assetCode: l.assetCode, isRented: l.isRented });
  const m = fill(mine, month, (l) => ({ key: l.machineKey, label: l.machineLabel }));
  return {
    ...m,
    rows: m.rows.map((r, i) => ({ ...r, no: i + 1, ...meta.get(r.key)! })),
  };
}
