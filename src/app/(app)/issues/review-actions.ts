"use server";

import { revalidatePath } from "next/cache";
import { requireWriter } from "@/lib/session";
import { acceptMachine, markChecked, mergeMachine } from "@/server/issues/review-service";

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const bad = { ok: false as const, message: "ไม่พบใบนี้" };
const done = (id: string) => {
  revalidatePath(`/issues/${id}`);
  revalidatePath("/issues");
  revalidatePath("/invoices");
  revalidatePath("/");
};

export async function markCheckedAction(id: string) {
  const s = await requireWriter();
  if (!isId(id)) return bad;
  const r = await markChecked(s, id);
  if (r.ok) done(id);
  return r;
}

export async function acceptMachineAction(issueId: string, machineId: string) {
  const s = await requireWriter();
  if (!isId(issueId) || !isId(machineId)) return bad;
  const r = await acceptMachine(s, issueId, machineId);
  if (r.ok) done(issueId);
  return r;
}

export async function mergeMachineAction(issueId: string, heldId: string, intoId: string) {
  const s = await requireWriter();
  if (!isId(issueId) || !isId(heldId) || !isId(intoId)) return bad;
  const r = await mergeMachine(s, issueId, heldId, intoId);
  if (r.ok) done(issueId);
  return r;
}
