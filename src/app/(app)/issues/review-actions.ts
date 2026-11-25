"use server";

import { revalidatePath } from "next/cache";
import { requireWriter } from "@/lib/session";
import { acceptMachine, correctAndCheck, markChecked, mergeMachine } from "@/server/issues/review-service";
import { hasAtMostTwoDecimals } from "@/domain/money";

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const bad = { ok: false as const, message: "ไม่พบใบนี้" };
const done = (id: string) => {
  revalidatePath("/check");
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

/** the check desk: liters read from the meter photos replace what the driver typed, with a reason, then "ตรวจแล้ว" */
export async function correctAndCheckAction(id: string, raw: unknown, reason: unknown) {
  const s = await requireWriter();
  if (!isId(id) || !Array.isArray(raw) || typeof reason !== "string") return bad;
  const liters: { position: number; liters: number }[] = [];
  for (const x of raw) {
    const position = Number((x as { position?: unknown })?.position);
    const n = Number(String((x as { liters?: unknown })?.liters ?? "").replace(/,/g, ""));
    if (!Number.isInteger(position) || position < 1) return bad;
    if (!Number.isFinite(n) || n <= 0) return { ok: false as const, message: `บรรทัด ${position}: ลิตรต้องมากกว่า 0` };
    if (!hasAtMostTwoDecimals(n)) return { ok: false as const, message: `บรรทัด ${position}: ลิตรมีทศนิยมได้ไม่เกิน 2 ตำแหน่ง` };
    liters.push({ position, liters: n });
  }
  const r = await correctAndCheck(s, id, liters, reason);
  if (r.ok) done(id);
  return r;
}
