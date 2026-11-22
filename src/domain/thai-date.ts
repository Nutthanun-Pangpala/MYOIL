/** Thai Buddhist-era dates from ISO `YYYY-MM-DD`. Pure string maths — no Date, no time zone surprises. */

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."] as const;

const MONTHS_FULL = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

function parts(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new RangeError(`not an ISO date: ${iso}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

const be2 = (y: number) => String((y + 543) % 100).padStart(2, "0");

/** table form: 17/11/69 */
export function thaiShort(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${be2(y)}`;
}

/** balance-book form: 1 มี.ค. 69 */
export function thaiLong(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${be2(y)}`;
}

/** month heading: กันยายน 2569 */
export function thaiMonth(iso: string): string {
  const { y, m } = parts(iso);
  return `${MONTHS_FULL[m - 1]} ${y + 543}`;
}

/** abbreviated month + full BE year: ก.ย. 2569 */
export function thaiMonthShort(iso: string): string {
  const { y, m } = parts(iso);
  return `${MONTHS[m - 1]} ${y + 543}`;
}
