import { isIsoDate, isMonth, monthRange } from "@/domain/iso-date";

/** ?month=YYYY-MM (default this month) or ?month=custom&from=&to= ; ?project=<id> (empty = every project) */
export function reportRange(get: (k: string) => string, today: string): { month: string; from: string; to: string } {
  const m = get("month");
  if (m === "custom") {
    const from = isIsoDate(get("from")) ? get("from") : monthRange(today.slice(0, 7)).start;
    const to = isIsoDate(get("to")) ? get("to") : today;
    return from <= to ? { month: "custom", from, to } : { month: "custom", from: to, to: from };
  }
  const month = isMonth(m) ? m : today.slice(0, 7);
  const r = monthRange(month);
  return { month, from: r.start, to: month === today.slice(0, 7) && today < r.end ? today : r.end };
}
