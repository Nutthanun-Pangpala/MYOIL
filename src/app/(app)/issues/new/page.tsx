import { requireWriter } from "@/lib/session";
import { keyedToday, machineOptions, projectOptions } from "@/server/issues/issue-service";
import { IssueForm } from "./issue-form";

export const metadata = { title: "บันทึกใบจ่าย" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function NewIssuePage({ searchParams }: { searchParams: SP }) {
  const session = await requireWriter();
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
  const [projects, machines, keyed] = await Promise.all([projectOptions(session), machineOptions(), keyedToday(session, today)]);

  // OBS-04 (BA): only "save and key the next one" passes book + next number; a plain open (or plain save) starts empty
  const initial = {
    issueDate: one(sp.date) || today,
    bookNo: one(sp.book),
    docNo: one(sp.doc),
  };
  // the slip just saved by "บันทึกและคีย์ใบถัดไป": "บันทึกแล้ว ใบจ่ายเล่มที่ … เลขที่ …" + ดูใบ
  const lastId = /^[0-9a-f-]{36}$/i.test(one(sp.last)) ? one(sp.last) : null;
  const [lastBook, lastDoc] = one(sp.lastNo).split("/");
  const saved = one(sp.saved) === "1" ? { id: lastId, label: lastBook && lastDoc ? `บันทึกแล้ว ใบจ่ายเล่มที่ ${lastBook} เลขที่ ${lastDoc}` : "บันทึกแล้ว" } : null;

  return <IssueForm projects={projects} machines={machines.map((m) => m.code)} initial={initial} saved={saved} keyedToday={keyed} />;
}
