import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** scrypt hash for passwords: "salt:hash" */
export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(secret: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(secret, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
