/** Number formatting for screens: tabular numbers get commas; liters up to 2 decimals, baht always 2. */

import { thaiShort } from "@/domain/thai-date";

const litersFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const bahtFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatLiters = (n: number) => litersFmt.format(n);
export const formatBaht = (n: number) => bahtFmt.format(n);

/** a moment on screen: "18/11/69 09:12", Bangkok time */
export function formatStamp(d: Date): string {
  const day = d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${thaiShort(day)} ${time}`;
}
