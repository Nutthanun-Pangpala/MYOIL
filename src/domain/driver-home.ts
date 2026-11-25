/** the driver home's tank card (design board "Main"): whole liters as odometer tiles, and how full to draw the truck */
export function odometer(liters: number): string[] {
  return Math.round(liters).toLocaleString("en-US").split("");
}

export function tankLevel(liters: number, capacity: number | null): number {
  if (!capacity) return liters > 0 ? 0.5 : 0;
  return Math.max(0, Math.min(1, liters / capacity));
}
