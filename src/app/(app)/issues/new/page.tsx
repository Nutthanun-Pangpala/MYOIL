import { requireWriter } from "@/lib/session";
import { machineOptions, projectOptions } from "@/server/issues/issue-service";
import { IssueForm } from "./issue-form";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function NewIssuePage({ searchParams }: { searchParams: SP }) {
  const session = await requireWriter();
  const sp = await searchParams;
  const [projects, machines] = await Promise.all([projectOptions(session), machineOptions()]);

  // OBS-04 (BA): only "save and key the next one" passes book + next number; a plain open (or plain save) starts empty
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
  const initial = {
    issueDate: one(sp.date) || today,
    bookNo: one(sp.book),
    docNo: one(sp.doc),
  };

  return (
    <IssueForm
      projects={projects}
      machines={machines.map((m) => m.code)}
      initial={initial}
      justSaved={one(sp.saved) === "1"}
    />
  );
}
