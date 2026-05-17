import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { memberSavings } from "@/actions/contributions";
import { formatInr } from "@/lib/money";

export default async function RosterPage() {
  const session = await auth();
  const groupId = session!.user.groupId;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const period = await prisma.contributionPeriod.findUnique({
    where: { groupId_year_month: { groupId, year, month } },
  });

  const members = await prisma.user.findMany({
    where: { groupId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  // Get this month's contribution status for each member
  const contributionMap = period
    ? await prisma.contribution.findMany({
        where: { periodId: period.id },
      }).then((cs) => new Map(cs.map((c) => [c.userId, c])))
    : new Map();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Member Roster</h1>
      <p className="text-sm text-gray-500">
        {new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" })} · {members.filter((m) => m.active).length} active members
      </p>

      <div className="space-y-3">
        {members.map((member) => {
          const contribution = contributionMap.get(member.id);
          const initials = member.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          const isPaid = contribution?.status === "PAID";

          return (
            <div key={member.id} className={`card ${!member.active ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand/10 text-brand text-sm font-bold flex items-center justify-center">
                    {initials}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{member.name}</p>
                    <p className="text-xs text-gray-400">{member.mobile}</p>
                  </div>
                </div>
                <div className="text-right">
                  {!member.active ? (
                    <span className="badge-closed">DEACTIVATED</span>
                  ) : !contribution ? (
                    <span className="badge-pending">NO RECORD</span>
                  ) : isPaid ? (
                    <span className="badge-paid">PAID</span>
                  ) : (
                    <span className="badge-unpaid">UNPAID</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {members.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-gray-400">No members yet</p>
        </div>
      )}
    </div>
  );
}
