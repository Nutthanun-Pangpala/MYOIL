import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="font-display text-4xl text-earth">
          MY<span className="rounded-control bg-safety px-2">OIL</span>
        </h1>
        <p className="mt-2 text-muted">สมุดบัญชีน้ำมันของสโตร์กลาง U WORK 999</p>
      </div>
      <div className="rounded-card border border-line bg-card p-6">
        <LoginForm />
      </div>
    </main>
  );
}
