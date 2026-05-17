import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MACS — Mutually Aided Cooperative Society",
  description: "Cooperative ledger and loan management system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
