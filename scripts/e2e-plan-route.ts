/**
 * e2e only (local DB): plan a day's route by project codes and print the stop ids in order, as JSON.
 *   tsx --env-file=.env scripts/e2e-plan-route.ts 2026-11-23 DEMO1 DEMO1 DEMO2
 */
import { bookcareUserId } from "@/server/bookcare/receive-service";
import { planByCodes } from "@/server/routes/route-service";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("local only");
  const [date, ...codes] = process.argv.slice(2);
  const ids = await planByCodes(await bookcareUserId(), date, codes);
  process.stdout.write(JSON.stringify(ids));
  process.exit(0);
}
void main();
