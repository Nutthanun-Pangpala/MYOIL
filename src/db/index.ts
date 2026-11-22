import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

// On Vercel every function instance opens its own connections → keep it to 1 and go through
// the pooled URL (pgbouncer, transaction mode), which doesn't support prepared statements.
const serverless = !!process.env.VERCEL;
const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL!, serverless ? { max: 1, prepare: false, idle_timeout: 20 } : {});
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
export { schema, sql as client };
