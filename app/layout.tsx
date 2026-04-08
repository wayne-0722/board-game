import "./globals.css";
import type { Metadata } from "next";

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
      <body>
        <div className="min-h-screen bg-brand-surface text-slate-900">
          <div className="max-w-md mx-auto px-4 pb-10">{children}</div>
        </div>
      </body>
    </html>
  );
}
