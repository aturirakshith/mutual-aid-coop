"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", label: "Home", icon: "🏠" },
  { href: "/admin/members", label: "Members", icon: "👥" },
  { href: "/admin/loans", label: "Loans", icon: "💰" },
  { href: "/admin/ledger", label: "Ledger", icon: "📊" },
];

const MEMBER_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/loans", label: "Loans", icon: "💰" },
  { href: "/roster", label: "Roster", icon: "👥" },
  { href: "/ledger", label: "Ledger", icon: "📊" },
];

export function BottomNav({ role }: { role: "ADMIN" | "MEMBER" }) {
  const pathname = usePathname();
  const items = role === "ADMIN" ? ADMIN_ITEMS : MEMBER_ITEMS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex-1 flex flex-col items-center justify-center py-2 text-xs gap-0.5 transition-colors",
              active ? "text-brand font-semibold" : "text-gray-400 hover:text-gray-600",
            )}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
