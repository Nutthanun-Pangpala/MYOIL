import { requireUser } from "@/lib/session";
import { allProjects, listUsers } from "@/server/settings/settings-service";
import { UsersPanel } from "./users-panel";

export default async function UsersPage() {
  const me = await requireUser();
  const [users, projects] = await Promise.all([listUsers(), allProjects()]);
  return <UsersPanel users={users} projects={projects.filter((p) => p.active).map((p) => ({ id: p.id, ref: p.ref, name: p.name }))} meId={me.userId} />;
}
