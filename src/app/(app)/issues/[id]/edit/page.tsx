import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireWriter } from "@/lib/session";
import { getIssueForEdit, machineOptions, projectOptions } from "@/server/issues/issue-service";
import { IssueForm } from "../../new/issue-form";

export default async function EditIssuePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireWriter();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const cur = await getIssueForEdit(session, id);
  if (!cur) notFound();

  if (cur.lock) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <h1 className="font-display text-2xl text-earth">แก้ไขใบจ่าย</h1>
        <p role="alert" className="rounded-control bg-repair-soft px-3 py-2 text-[14px] text-repair">
          {cur.lock}
        </p>
        <Link href={`/issues/${id}`} className="text-[14px] text-earth underline">
          กลับไปดูใบ
        </Link>
      </div>
    );
  }
  if (!cur.input.projectId) redirect(`/issues/${id}`);

  const [projects, machines] = await Promise.all([projectOptions(session), machineOptions()]);
  const p = projects.find((x) => x.id === cur.input.projectId);
  // a project the person can no longer pick (inactive) still shows by its code
  const projectText = p ? `${p.refCode} — ${p.name}` : "";
  return (
    <IssueForm
      projects={projects}
      machines={machines.map((m) => m.code)}
      initial={{ issueDate: cur.input.issueDate, bookNo: cur.input.bookNo, docNo: cur.input.docNo }}
      justSaved={false}
      edit={{ id, input: cur.input, projectText }}
    />
  );
}
