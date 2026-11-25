import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Role } from "./labels";
import { canAdminister, canWriteFuel } from "./permissions";

/**
 * Signed-cookie session (HMAC-SHA256), same approach as BookCare.
 * Staff log in with email + password; no self sign-up. The account is re-checked on every
 * request, so a deactivation or role change applies at once.
 */
export type Session = { userId: string; role: Role; name: string };

const COOKIE = "myoil_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return s || "dev-only-secret-change-me";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(s: Session) {
  const payload = Buffer.from(JSON.stringify({ ...s, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const a = Buffer.from(sign(payload));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let userId: string;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof d.exp !== "number" || d.exp < Date.now() || typeof d.userId !== "string") return null;
    userId = d.userId;
  } catch {
    return null;
  }
  try {
    const [u] = await db
      .select({ id: schema.users.id, role: schema.users.role, name: schema.users.name, active: schema.users.active })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (!u || !u.active) return null;
    return { userId: u.id, role: u.role, name: u.name };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** any signed-in user */
export async function requireUser(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** the fuel-truck driver's screens (/driver). Office people are sent to their own home */
export async function requireDriver(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login/driver");
  if (s.role !== "driver") redirect("/");
  return s;
}

/** may key / change fuel records */
export async function requireWriter(): Promise<Session> {
  const s = await requireUser();
  if (!canWriteFuel(s)) redirect("/");
  return s;
}

/** system_admin only */
export async function requireAdministrator(): Promise<Session> {
  const s = await requireUser();
  if (!canAdminister(s)) redirect("/");
  return s;
}
