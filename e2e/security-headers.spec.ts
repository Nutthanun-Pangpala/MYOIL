import { expect, test } from "@playwright/test";

/** OBS-20 (test round 9): every page and API answer carries the security headers, and doesn't say it is Next.js */
for (const path of ["/login", "/api/bookcare/v1/tank"]) {
  test(`security headers on ${path}`, async ({ request }) => {
    const h = (await request.get(path)).headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });
}

test("the camera is allowed only on the driver's screens, and each page says so once", async ({ request }) => {
  const policy = async (path: string) => (await request.get(path, { maxRedirects: 0 })).headers()["permissions-policy"];
  const off = "camera=(), microphone=(), geolocation=(), payment=()";
  const on = "camera=(self), microphone=(), geolocation=(), payment=()";
  expect(await policy("/login")).toBe(off);
  expect(await policy("/")).toBe(off);
  expect(await policy("/api/health")).toBe(off);
  expect(await policy("/login/driver")).toBe(on);
  expect(await policy("/driver")).toBe(on);
  expect(await policy("/driver/refill")).toBe(on);
});
