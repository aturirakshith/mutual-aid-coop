import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/money";
import { memberSavings } from "@/actions/contributions";
import Link from "next/link";

export default async function MembersPage() {
  const session = await auth();
  const groupId = session!.user.groupId;

  const members = await prisma.user.findMany({
    where: { groupId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      loans: {
        where: { status: "DISBURSED" },
        include: { emis: true, guarantors: true },
      },
      guaranteedLoans: {
        where: { loan: { status: "DISBURSED" } },
        include: { loan: { include: { emis: true, guarantors: true } } },
      },
    },
  });

  // Compute savings for each member
  const membersWithSavings = await Promise.all(
    members.map(async (m) => {
      const savings = await memberSavings(m.id);
      const unpaidCount = await prisma.contribution.count({
        where: { userId: m.id, status: "UNPAID" },
      });

      // Total outstanding as borrower
      const totalOutstanding = m.loans.reduce((sum, loan) => {
        const paidEmis = loan.emis.filter((e) => e.status === "PAID");
        const paid = paidEmis.reduce((s, e) => s + e.amountPaise, 0);
        return sum + (loan.principalPaise ?? 0) - paid;
      }, 0);

      // Total guarantor exposure
      const totalExposure = m.guaranteedLoans.reduce((sum, lg) => {
        const loan = lg.loan;
        const paidEmis = loan.emis.filter((e) => e.status === "PAID");
        const paid = paidEmis.reduce((s, e) => s + e.amountPaise, 0);
        const outstanding = (loan.principalPaise ?? 0) - paid;
        const numGuarantors = loan.guarantors.length;
        return sum + (numGuarantors > 0 ? outstanding / numGuarantors : 0);
      }, 0);

      return { ...m, savings, unpaidCount, totalOutstanding, totalExposure };
    }),
  );

  const negativeCount = membersWithSavings.filter((m) => m.savings < 0 && m.active).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-xs text-gray-400">
            {members.filter((m) => m.active).length} active ·{" "}
            {negativeCount > 0 && (
              <span className="text-red-500 font-semibold">{negativeCount} negative savings</span>
            )}
          </p>
        </div>
        <Link href="/admin/members/new" className="bg-brand text-white text-sm font-bold px-4 py-2 rounded-xl">
          + Add
        </Link>
      </div>

      <div className="space-y-3">
        {membersWithSavings.map((member) => {
          const initials = member.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <Link
              key={member.id}
              href={`/admin/members/${member.id}`}
              className={`card block hover:shadow-md transition-shadow ${!member.active ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between">
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
                  ) : member.unpaidCount > 0 ? (
                    <span className="badge-unpaid">INELIGIBLE</span>
                  ) : (
                    <span className="badge-paid">ACTIVE</span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400">Savings</p>
                  <p className={`font-semibold ${member.savings < 0 ? "text-red-500" : "text-gray-900"}`}>
                    {formatInr(member.savings)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Outstanding Loan</p>
                  <p className="font-semibold text-gray-900">{formatInr(member.totalOutstanding)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Guarantor Exposure</p>
                  <p className="font-semibold text-gray-900">{formatInr(member.totalExposure)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Active Loans</p>
                  <p className="font-semibold text-gray-900">{member.loans.length}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
