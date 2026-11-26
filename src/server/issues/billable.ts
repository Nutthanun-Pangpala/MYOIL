import { and, isNull, sql } from "drizzle-orm";
import { schema } from "@/db";

/** SQL twin of countsInInvoice() without the cancelled part: signed, and checked when it came from the phone */
export const billableSql = sql<boolean>`(${schema.fuelIssues.receivedSigned} and ${schema.fuelIssues.reviewStatus} = 'checked')`;

/**
 * A phone slip dated after the (Bangkok) day it reached MYOIL (BA, 26 Nov 2026; flag "dated_ahead" in domain/bookcare-flags):
 * the phone's clock was wrong, so the slip counts nowhere until an admin puts the date right. Paper slips never match
 * (they have no received_at, and the form refuses a future date).
 */
export const datedAheadSql = sql<boolean>`coalesce(${schema.fuelIssues.issueDate} > (${schema.fuelIssues.receivedAt} at time zone 'Asia/Bangkok')::date, false)`;

/** a slip that counts in the book, the monthly table, the reports and the price queue: not cancelled, not dated ahead */
export const countsSql = and(isNull(schema.fuelIssues.cancelledAt), sql`not ${datedAheadSql}`)!;
