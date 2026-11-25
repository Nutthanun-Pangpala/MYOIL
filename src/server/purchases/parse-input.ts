/**
 * Browser input → well-formed values (right types, bounded sizes). Garbage becomes empty values,
 * which the rules then report as ordinary field errors. Same idea as issues/parse-input.ts.
 */

export type PurchaseInput = {
  date: string;
  /** "HH:MM" on the bill: with the date it decides which bill is used up first (brief §14 B9) */
  time: string;
  liters: number | null;
  price: number | null;
  amount: number | null;
  billNo: string;
  note: string;
  /** downsized bill photo as the browser sends it; the service checks the bytes */
  billPhoto: { mime: string; base64: string } | null;
  /** the person saw the "looks odd" questions and pressed save anyway (OBS-17) */
  confirmed: boolean;
};
export type PriceInput = { date: string; price: number | null };

const obj = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** a real calendar date in ISO form, else "" */
const isoDate = (v: unknown) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? "" : v;
};

/** a real time of day "HH:MM", else "" */
export const clock = (v: unknown) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "");

export function parsePurchaseInput(raw: unknown): PurchaseInput {
  const r = obj(raw);
  return {
    date: isoDate(r.date),
    time: clock(r.time),
    liters: num(r.liters),
    price: num(r.price),
    amount: num(r.amount),
    billNo: str(r.billNo, 50),
    note: str(r.note, 300),
    billPhoto: photo(r.billPhoto),
    confirmed: r.confirmed === true,
  };
}

const MAX_BASE64 = 1_400_000; // ≈ 1 MB of image
function photo(v: unknown): PurchaseInput["billPhoto"] {
  const o = obj(v);
  const mime = typeof o.mime === "string" ? o.mime : "";
  const base64 = typeof o.base64 === "string" ? o.base64 : "";
  if (!["image/jpeg", "image/png"].includes(mime) || !base64 || base64.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(base64)) return null;
  return { mime, base64 };
}

export function parsePriceInput(raw: unknown): PriceInput {
  const r = obj(raw);
  return { date: isoDate(r.date), price: num(r.price) };
}
