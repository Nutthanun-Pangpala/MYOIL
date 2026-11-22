"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator, requireWriter } from "@/lib/session";
import { advanceInvoice, closeCycle, reopenCycle, saveInvoiceCode } from "@/server/cycles/cycle-service";

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const bad = { ok: false as const, message: "ไม่พบรอบหรือใบแจ้งนี้" };
const refresh = () => {
  revalidatePath("/invoices", "layout");
  revalidatePath("/issues");
  revalidatePath("/");
};

export async function closeCycleAction(cycleId: string) {
  const s = await requireWriter();
  if (!isId(cycleId)) return bad;
  const r = await closeCycle(s, cycleId);
  if (r.ok) refresh();
  return r;
}

/** system_admin only, with a reason */
export async function reopenCycleAction(cycleId: string, reason: string) {
  const s = await requireAdministrator();
  if (!isId(cycleId)) return bad;
  const r = await reopenCycle(s, cycleId, typeof reason === "string" ? reason : "");
  if (r.ok) refresh();
  return r;
}

export async function advanceInvoiceAction(cycleId: string, projectId: string) {
  const s = await requireWriter();
  if (!isId(cycleId) || !isId(projectId)) return bad;
  const r = await advanceInvoice(s, cycleId, projectId);
  if (r.ok) refresh();
  return r;
}

export async function saveInvoiceCodeAction(cycleId: string, projectId: string, code: string) {
  const s = await requireWriter();
  if (!isId(cycleId) || !isId(projectId)) return bad;
  const r = await saveInvoiceCode(s, cycleId, projectId, typeof code === "string" ? code : "");
  if (r.ok) refresh();
  return r;
}
