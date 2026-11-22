"use server";

import { revalidatePath } from "next/cache";
import { requireWriter } from "@/lib/session";
import { parseStockCheckInput } from "@/server/ledger/parse-input";
import { setLedgerNote, setStockCheck } from "@/server/ledger/ledger-service";

/** the "วัดได้จริง" box of one day: save on blur; empty clears */
export async function saveStockCheckAction(raw: unknown): Promise<{ ok: boolean }> {
  const session = await requireWriter();
  const input = parseStockCheckInput(raw);
  if (!input.date) return { ok: false };
  await setStockCheck(session, input.date, input.liters);
  revalidatePath("/ledger");
  return { ok: true };
}

/** the หมายเหตุ box of one day: save on blur; empty clears */
export async function saveLedgerNoteAction(date: string, note: string): Promise<{ ok: boolean }> {
  const session = await requireWriter();
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return { ok: false };
  await setLedgerNote(session, date, typeof note === "string" ? note : "");
  revalidatePath("/ledger");
  return { ok: true };
}
