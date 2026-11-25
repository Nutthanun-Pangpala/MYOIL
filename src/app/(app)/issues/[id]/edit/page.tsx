import { Alert, PageHeader } from "@/components/ui";
import { notFound, redirect } from "next/navigation";
import { requireWriter } from "@/lib/session";
import { getIssueForEdit, machineOptions, projectOptions } from "@/server/issues/issue-service";
import { IssueForm } from "../../new/issue-form";

export const metadata = { title: "แก้ไขใบจ่าย" };

export default async function EditIssuePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireWriter();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const cur = await getIssueForEdit(session, id);
  if (!cur) notFound();

  if (cur.lock) {
    return (
      <>
        <PageHeader title={`แก้ไขใบจ่าย เล่มที่ ${cur.input.bookNo} เลขที่ ${cur.input.docNo}`} back={{ href: `/issues/${id}`, label: "กลับไปดูใบจ่ายนี้" }} />
        <Alert className="max-w-3xl">{cur.lock}</Alert>
      </>
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
      saved={null}
      edit={{ id, input: cur.input, projectText, savedAt: cur.savedAt }}
    />
  );
}
