"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { verifySecret } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

// verified against this when the email is unknown, so "no such user" costs the same time as "wrong password"
const DUMMY_HASH = "00".repeat(16) + ":" + "00".repeat(64);

export async function login(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");

  const [u] = email ? await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1) : [];
  const good = verifySecret(password, u?.passwordHash ?? DUMMY_HASH);
  if (!u || !u.active || !good) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

  await createSession({ userId: u.id, role: u.role, name: u.name });
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
