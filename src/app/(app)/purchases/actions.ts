"use server";

import { revalidatePath } from "next/cache";
import { requireWriter } from "@/lib/session";
import { parsePriceInput, parsePurchaseInput } from "@/server/purchases/parse-input";
import { cancelPurchase, confirmPurchase, createPurchase, restorePurchase, setDailyPrice, updatePurchase, type ChangeResult, type SaveResult } from "@/server/purchases/purchase-service";

function refresh() {
  // purchases move the book and may price waiting slips
  for (const p of ["/purchases", "/issues", "/ledger", "/monthly", "/invoices"]) revalidatePath(p);
}

export async function savePurchaseAction(raw: unknown): Promise<SaveResult> {
  const session = await requireWriter();
  const r = await createPurchase(session, parsePurchaseInput(raw));
  if (r.ok) refresh();
  return r;
}

export async function savePriceAction(raw: unknown): Promise<SaveResult> {
  const session = await requireWriter();
  const r = await setDailyPrice(session, parsePriceInput(raw));
  if (r.ok) refresh();
  return r;
}

export async function updatePurchaseAction(id: string, raw: unknown): Promise<SaveResult> {
  const session = await requireWriter();
  const r = await updatePurchase(session, id, parsePurchaseInput(raw));
  if (r.ok) refresh();
  return r;
}

export async function cancelPurchaseAction(id: string, reason: string): Promise<ChangeResult> {
  const session = await requireWriter();
  const r = await cancelPurchase(session, id, typeof reason === "string" ? reason.slice(0, 300) : "");
  if (r.ok) refresh();
  return r;
}

export async function restorePurchaseAction(id: string): Promise<ChangeResult> {
  const session = await requireWriter();
  const r = await restorePurchase(session, id);
  if (r.ok) refresh();
  return r;
}

export async function confirmPurchaseAction(id: string): Promise<ChangeResult & { warnings?: string[] }> {
  const session = await requireWriter();
  const r = await confirmPurchase(session, id);
  if (r.ok) refresh();
  return r;
}
