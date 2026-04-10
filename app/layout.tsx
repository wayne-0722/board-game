import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Board Game Answer System",
  description: "Mobile-first realtime answer system for a physical board game"
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
          {children}
        </div>
      </body>
    </html>
  );
}
