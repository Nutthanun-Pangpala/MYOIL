import { cookies } from "next/headers";

/**
 * "Remember this phone on this device" for the driver login (same idea as BookCare's): only who signed in last —
 * phone and name — never the PIN. The next login on that phone is just the PIN.
 */
const DRIVER = "myoil_last_driver";
const YEAR = 60 * 60 * 24 * 365;

export type LastDriver = { phone: string; name: string };

export async function rememberDriver(d: LastDriver) {
  (await cookies()).set(DRIVER, encodeURIComponent(JSON.stringify(d)), { httpOnly: true, sameSite: "lax", path: "/", maxAge: YEAR, secure: process.env.NODE_ENV === "production" });
}

export async function lastDriver(): Promise<LastDriver | null> {
  const raw = (await cookies()).get(DRIVER)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    return typeof v?.phone === "string" && /^0\d{9}$/.test(v.phone) && typeof v?.name === "string" ? { phone: v.phone, name: v.name.slice(0, 100) } : null;
  } catch {
    return null;
  }
}

export async function forgetDriverCookie() {
  (await cookies()).delete(DRIVER);
}
