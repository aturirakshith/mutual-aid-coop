import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/nav/top-nav";
import { BottomNav } from "@/components/nav/bottom-nav";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-gray-50">
      <TopNav role="MEMBER" userName={session.user.name} />
      <main className="flex-1 pb-20 overflow-y-auto">{children}</main>
      <BottomNav role="MEMBER" />
    </div>
  );
}
