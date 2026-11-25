import type { NextConfig } from "next";

/**
 * Security headers on every response (OBS-20, test round 9).
 * The CSP only locks what cannot break the app: no framing (clickjacking), no <base> or form posts to another
 * site, no plugins. Scripts/styles are left to Next.js (a strict script-src needs nonces on every page).
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
// the camera is off everywhere except the driver's phone screens, which photograph the meter and the bill
const policy = (camera: string) => ({ key: "Permissions-Policy", value: `camera=${camera}, microphone=(), geolocation=(), payment=()` });

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  poweredByHeader: false,
  async headers() {
    // One Permissions-Policy per page: two matching rules would send the header twice, and the browser then keeps the strictest (camera off).
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/((?!driver$|driver/|login/driver$).*)", headers: [policy("()")] },
      // the driver's login page too: after signing in, the app moves to /driver without loading a new document
      { source: "/login/driver", headers: [policy("(self)")] },
      { source: "/driver/:path*", headers: [policy("(self)")] },
    ];
  },
};

export default nextConfig;
