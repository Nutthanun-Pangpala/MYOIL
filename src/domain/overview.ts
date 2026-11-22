/** Numbers behind the overview page (6.2). Pure. */
import { sumAmounts, sumLiters } from "./money";

export type TankLevel = {
  status: "ok" | "low" | "negative";
  /** 0–100, null when the tank size is not set */
  percent: number | null;
  /** the big number as shown, e.g. "1,665" or "-229" */
  text: string;
};

/** `low` = the admin's low mark, else 20% of the tank */
export function tankLevel(level: number, capacity: number | null, low: number | null): TankLevel {
  // no tank size = nothing to measure "almost empty" against (BA 22 Nov), whatever the low mark says
  const mark = capacity ? (low ?? capacity * 0.2) : null;
  const status = level < 0 ? "negative" : mark !== null && level <= mark ? "low" : "ok";
  const percent = capacity ? Math.round(Math.max(0, Math.min(1, level / capacity)) * 100) : null;
  return { status, percent, text: Math.round(level).toLocaleString("en-US") };
}

export type BreakdownLine = { issueId: string; projectKey: string; projectLabel: string; liters: number; amount: number | null; signed?: boolean };

export function projectBreakdown(lines: BreakdownLine[]) {
  const by = new Map<string, { label: string; slips: Set<string>; liters: number[]; amounts: number[] }>();
  for (const l of lines) {
    const g = by.get(l.projectKey) ?? { label: l.projectLabel, slips: new Set<string>(), liters: [], amounts: [] };
    g.slips.add(l.issueId);
    g.liters.push(l.liters);
    if (l.amount !== null) g.amounts.push(l.amount);
    by.set(l.projectKey, g);
  }
  const rows = [...by.entries()]
    .map(([key, g]) => ({ key, label: g.label, slips: g.slips.size, liters: sumLiters(g.liters), amount: sumAmounts(g.amounts), pct: 0 }))
    .sort((a, b) => b.liters - a.liters || a.label.localeCompare(b.label));
  const top = rows[0]?.liters ?? 0;
  for (const r of rows) r.pct = top > 0 ? Math.round((r.liters / top) * 100) : 0;
  return {
    rows,
    liters: sumLiters(rows.map((r) => r.liters)),
    amount: sumAmounts(rows.map((r) => r.amount)),
    /** part of `amount` on slips nobody has signed for yet (not in any invoice) */
    unsignedAmount: sumAmounts(lines.filter((l) => l.signed === false && l.amount !== null).map((l) => l.amount as number)),
    slips: rows.reduce((s, r) => s + r.slips, 0),
  };
}
