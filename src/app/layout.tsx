import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Kanit } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
});

const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-kanit",
});

export const metadata: Metadata = {
  // each page sets its own name: the tab reads "ใบจ่ายน้ำมัน · MYOIL"; icon = src/app/icon.svg (23 Nov 2026)
  title: { default: "MYOIL — สมุดบัญชีน้ำมัน U WORK 999", template: "%s · MYOIL" },
  applicationName: "MYOIL",
  description: "บันทึกน้ำมันเข้า-ออกรถเติมน้ำมัน และออกใบแจ้งค่าใช้จ่ายรายโครงการ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${plex.variable} ${kanit.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
