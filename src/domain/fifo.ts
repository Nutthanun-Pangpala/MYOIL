import { lineAmount, sumAmounts } from "./money";

/**
 * Price by purchase bill, oldest fuel first (brief §14, B1–B10; owner 25 Nov 2026).
 * Every liter issued takes the price of the bill it came from: a slip draws on the oldest bill that still has
 * liters, then on the next one. A slip that crosses two bills is split into two prices.
 * Pure: no database. Liters and money are plain numbers with at most 2 decimals.
 */

/** something that put fuel in the truck: the opening stock (id null) or one purchase bill */
export type Lot = {
  id: string | null;
  /** when it arrived: "2026-11-25T08:00" (date + time; sorts as text) */
  at: string;
  liters: number;
  /** null = no price yet (a bill the admin has not confirmed, or opening stock with no price set) → "รอราคา" */
  price: number | null;
};

/** a piece of a line at one price. `kind` "none" = liters no bill covers (more issued than bought so far) */
export type Part = { kind: "bill" | "opening" | "none"; lotId: string | null; liters: number; price: number | null; amount: number | null };

export type FifoLine = {
  id: string;
  /** when the fuel left: date + time of its slip; lines of one slip share it and go in the order given */
  at: string;
  liters: number;
  /** a slip of a closed cycle: its parts are kept exactly as they were billed (B5) */
  frozen?: Part[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Walks bills and slips in time order (a bill and a slip at the same minute: the bill first).
 * A line takes liters from the oldest lot that has arrived and still has some. When nothing that has arrived
 * is left, the rest of the line has no price ("รอราคา", lot undefined) — it is not taken from a later bill:
 * fuel cannot be issued before it is bought, so the dates or liters have to be put right at the source (B4, B7).
 * Frozen lines only use up their lots; they are returned unchanged.
 */
export function allocateFifo(lots: readonly Lot[], lines: readonly FifoLine[]): { parts: Map<string, Part[]>; left: { lot: Lot; liters: number }[] } {
  const stock = lots.map((lot) => ({ lot, liters: lot.liters })).sort((a, b) => (a.lot.at < b.lot.at ? -1 : a.lot.at > b.lot.at ? 1 : 0));
  const parts = new Map<string, Part[]>();

  for (const line of lines) {
    if (line.frozen) {
      for (const f of line.frozen) {
        const s = f.kind === "none" ? undefined : stock.find((x) => x.lot.id === f.lotId);
        if (s) s.liters = r2(Math.max(0, s.liters - f.liters));
      }
      parts.set(line.id, line.frozen);
      continue;
    }
    const out: Part[] = [];
    let need = r2(line.liters);
    for (const s of stock) {
      if (need <= 0) break;
      if (s.lot.at > line.at || s.liters <= 0) continue;
      const take = r2(Math.min(need, s.liters));
      s.liters = r2(s.liters - take);
      need = r2(need - take);
      out.push({ kind: s.lot.id === null ? "opening" : "bill", lotId: s.lot.id, liters: take, price: s.lot.price, amount: s.lot.price === null ? null : lineAmount(take, s.lot.price) });
    }
    if (need > 0) out.push({ kind: "none", lotId: null, liters: need, price: null, amount: null });
    parts.set(line.id, out);
  }
  return { parts, left: stock.filter((s) => s.liters > 0) };
}

/** money of a line: the sum of its parts, or null while any part still waits for a price */
export function partsAmount(parts: readonly Part[]): number | null {
  return parts.length === 0 || parts.some((p) => p.amount === null) ? null : sumAmounts(parts.map((p) => p.amount!));
}

/** the one price of a line, or null when it waits or is split over two prices */
export function partsPrice(parts: readonly Part[]): number | null {
  const prices = new Set(parts.map((p) => p.price));
  return prices.size === 1 ? [...prices][0] : null;
}

/** value of the fuel still in the truck: what is left of each lot at its own price (unpriced lots count 0) */
export function stockValue(left: readonly { lot: Lot; liters: number }[]): { liters: number; amount: number } {
  return {
    liters: r2(left.reduce((a, s) => a + s.liters, 0)),
    amount: sumAmounts(left.filter((s) => s.lot.price !== null).map((s) => lineAmount(s.liters, s.lot.price!))),
  };
}
