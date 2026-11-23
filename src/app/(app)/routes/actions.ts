"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRealDate } from "@/domain/bookcare-api";
import { requireWriter } from "@/lib/session";
import { addStop, copyPreviousRoute, moveRouteStop, removeStop, updateStopNote, type PlanResult } from "@/server/routes/route-service";

/** every change lands back on the same day with a message (?msg= / ?err=) — plain forms, no client code */
function back(date: string, r: PlanResult, okMsg: string): never {
  revalidatePath("/routes");
  const q = r.ok ? `msg=${encodeURIComponent(okMsg)}` : `err=${encodeURIComponent(r.message)}`;
  redirect(`/routes?date=${date}&${q}`);
}

const day = (fd: FormData) => {
  const d = String(fd.get("date") ?? "");
  if (!isRealDate(d)) redirect("/routes");
  return d;
};

export async function addStopAction(fd: FormData) {
  const s = await requireWriter();
  const date = day(fd);
  const projectId = String(fd.get("projectId") ?? "");
  if (!projectId) back(date, { ok: false, message: "เลือกโครงการก่อน" }, "");
  back(date, await addStop(s.userId, date, projectId, String(fd.get("note") ?? "")), "เพิ่มจุดแล้ว");
}

export async function noteAction(fd: FormData) {
  await requireWriter();
  back(day(fd), await updateStopNote(String(fd.get("stopId")), String(fd.get("note") ?? "")), "บันทึกหมายเหตุแล้ว");
}

export async function moveAction(fd: FormData) {
  await requireWriter();
  back(day(fd), await moveRouteStop(String(fd.get("stopId")), fd.get("dir") === "up" ? -1 : 1), "สลับลำดับแล้ว");
}

export async function removeAction(fd: FormData) {
  await requireWriter();
  back(day(fd), await removeStop(String(fd.get("stopId"))), "ลบจุดแล้ว");
}

export async function copyAction(fd: FormData) {
  const s = await requireWriter();
  const date = day(fd);
  const r = await copyPreviousRoute(s.userId, date);
  back(date, r, r.ok ? `คัดลอกเส้นทางจากวันที่ ${r.from} แล้ว` : "");
}
