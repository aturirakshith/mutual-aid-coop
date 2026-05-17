"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

interface TopNavProps {
  role: "ADMIN" | "MEMBER";
  userName?: string;
}

export function TopNav({ role, userName }: TopNavProps) {
  const initials = userName
    ? userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  const home = role === "ADMIN" ? "/admin/dashboard" : "/dashboard";

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
      <Link href={home} className="flex items-center gap-2">
        <span className="text-brand font-bold text-lg tracking-tight">🏛 MACS</span>
      </Link>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-9 h-9 rounded-full bg-brand text-white text-sm font-bold flex items-center justify-center hover:bg-brand-light transition-colors"
        title={`Signed in as ${userName}`}
      >
        {initials}
      </button>
    </header>
  );
}
