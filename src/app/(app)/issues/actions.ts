"use server";

import { requireWriter } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { cancelIssue, createIssue, markIssueSigned, previewIssue, removeSignedPhoto, restoreIssue, saveSignedPhoto, updateIssue } from "@/server/issues/issue-service";
import { parseSlipPhoto } from "@/server/issues/slip-photo";
import { parseIssueInput } from "@/server/issues/parse-input";

/** live checks while the admin types — same rules as the save */
export async function previewIssueAction(raw: unknown, editId?: string) {
  await requireWriter();
  return previewIssue(parseIssueInput(raw), isId(editId) ? editId : undefined);
}

/** the signed-slip photo (optional) travels with the new slip; if only the photo fails the slip is still saved */
export async function saveIssueAction(raw: unknown, photo?: unknown) {
  const session = await requireWriter();
  const res = await createIssue(session, parseIssueInput(raw));
  if (!res.ok || photo == null) return { ...res, photoError: null as string | null };
  const p = await saveSignedPhoto(session, res.id, parseSlipPhoto(photo));
  return { ...res, photoError: p.ok ? null : p.message };
}

export async function attachSignedPhotoAction(id: string, photo: unknown) {
  const session = await requireWriter();
  if (!isId(id)) return { ok: false as const, message: "ไม่พบใบนี้" };
  const r = await saveSignedPhoto(session, id, parseSlipPhoto(photo));
  if (r.ok) done(id);
  return r;
}

export async function removeSignedPhotoAction(id: string) {
  const session = await requireWriter();
  if (!isId(id)) return { ok: false as const, message: "ไม่พบใบนี้" };
  const r = await removeSignedPhoto(session, id);
  if (r.ok) done(id);
  return r;
}

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const done = (id: string) => {
  revalidatePath(`/issues/${id}`);
  revalidatePath("/issues");
};

export async function updateIssueAction(id: string, raw: unknown) {
  const session = await requireWriter();
  if (!isId(id)) return { ok: false as const, message: "ไม่พบใบนี้" };
  const r = await updateIssue(session, id, parseIssueInput(raw));
  if (r.ok) done(id);
  return r;
}

export async function signIssueAction(id: string, receiverName: string) {
  const session = await requireWriter();
  if (!isId(id)) return { ok: false as const, message: "ไม่พบใบนี้" };
  const r = await markIssueSigned(session, id, typeof receiverName === "string" ? receiverName : "");
  if (r.ok) done(id);
  return r;
}

export async function cancelIssueAction(id: string, reason: string) {
  const session = await requireWriter();
  if (!isId(id)) return { ok: false as const, message: "ไม่พบใบนี้" };
  const r = await cancelIssue(session, id, typeof reason === "string" ? reason : "");
  if (r.ok) done(id);
  return r;
}

export async function restoreIssueAction(id: string) {
  const session = await requireWriter();
  if (!isId(id)) return { ok: false as const, message: "ไม่พบใบนี้" };
  const r = await restoreIssue(session, id);
  if (r.ok) done(id);
  return r;
}
