import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/nav/top-nav";
import { BottomNav } from "@/components/nav/bottom-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/login");

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-gray-50">
      <TopNav role="ADMIN" userName={session.user.name} />
      <main className="flex-1 pb-20 overflow-y-auto">{children}</main>
      <BottomNav role="ADMIN" />
    </div>
  );
}
