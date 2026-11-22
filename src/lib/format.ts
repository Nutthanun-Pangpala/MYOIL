/** Number formatting for screens: tabular numbers get commas; liters up to 2 decimals, baht always 2. */

const litersFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const bahtFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatLiters = (n: number) => litersFmt.format(n);
export const formatBaht = (n: number) => bahtFmt.format(n);
