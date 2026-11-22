export type StockCheckInput = { date: string; liters: number | null };

const isoDate = (v: unknown) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? "" : v;
};

/** browser input → date + liters (null = clear the measurement). Garbage becomes empty values. */
export function parseStockCheckInput(raw: unknown): StockCheckInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const l = r.liters;
  return { date: isoDate(r.date), liters: typeof l === "number" && Number.isFinite(l) && l >= 0 ? l : null };
}
