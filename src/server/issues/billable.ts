import { sql } from "drizzle-orm";
import { schema } from "@/db";

/** SQL twin of countsInInvoice() without the cancelled part: signed, and checked when it came from the phone */
export const billableSql = sql<boolean>`(${schema.fuelIssues.receivedSigned} and ${schema.fuelIssues.reviewStatus} = 'checked')`;
