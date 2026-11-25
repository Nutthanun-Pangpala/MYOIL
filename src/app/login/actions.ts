"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { verifySecret } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";

/** `email` comes back so a refused login keeps it; `at` makes each refusal a new message (read out again) */
export type LoginState = { error?: string; email?: string; at?: number } | undefined;

// design 6.1 wording
const WRONG_LOGIN = "อีเมลหรือรหัสผ่านไม่ถูกต้อง ลองพิมพ์ใหม่ และดูว่าแป้นพิมพ์เป็นภาษาอังกฤษ";
const CLOSED_ACCOUNT = "บัญชีนี้ถูกปิดการใช้งาน ติดต่อผู้ดูแลระบบเพื่อเปิดใช้อีกครั้ง";

// verified against this when the email is unknown, so "no such user" costs the same time as "wrong password"
const DUMMY_HASH = "00".repeat(16) + ":" + "00".repeat(64);

export async function login(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");

  const [u] = email ? await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1) : [];
  const good = verifySecret(password, u?.passwordHash ?? DUMMY_HASH);
  // drivers have no email login (theirs is phone + PIN at /login/driver)
  if (!u || !good || u.role === "driver") return { error: WRONG_LOGIN, email, at: Date.now() };
  // only someone who knows the password learns that the account is closed
  if (!u.active) return { error: CLOSED_ACCOUNT, email, at: Date.now() };

  await createSession({ userId: u.id, role: u.role, name: u.name });
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
