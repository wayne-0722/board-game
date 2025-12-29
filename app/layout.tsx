import "./globals.css";
import { Manrope } from "next/font/google";
import type { Metadata } from "next";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "Board Turn Mock",
  description: "Mobile-first turn-based quiz flow prototype"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body className={manrope.className}>
        <div className="min-h-screen bg-brand-surface text-slate-900">
          <div className="max-w-md mx-auto px-4 pb-10">{children}</div>
        </div>
      </body>
    </html>
  );
}
