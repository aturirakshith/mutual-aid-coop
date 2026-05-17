import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMemberDetail } from "@/actions/members";
import { memberSavings, isLoanEligible } from "@/actions/contributions";
import { formatInr } from "@/lib/money";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeactivateButton } from "./deactivate-button";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const member = await getMemberDetail(id);
  if (!member || member.groupId !== session!.user.groupId) notFound();

  const [savings, eligible] = await Promise.all([
    memberSavings(id),
    isLoanEligible(id),
  ]);

  const unpaidContributions = await prisma.contribution.findMany({
    where: { userId: id, status: "UNPAID" },
    include: { period: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return (
    <div className="p-4 space-y-4">
      <Link href="/admin/members" className="text-brand text-sm flex items-center gap-1">
        ← Back to Members
      </Link>

      {/* Member header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-brand/10 text-brand text-lg font-bold flex items-center justify-center">
            {member.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{member.name}</h1>
            <p className="text-sm text-gray-500">{member.mobile}</p>
            <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${
              !member.active ? "bg-gray-100 text-gray-500" :
              !eligible ? "bg-red-100 text-red-600" :
              "bg-green-100 text-green-700"
            }`}>
              {!member.active ? "DEACTIVATED" : !eligible ? "LOAN INELIGIBLE" : "ACTIVE"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Savings Balance</p>
            <p className={`text-lg font-bold ${savings < 0 ? "text-red-500" : "text-gray-900"}`}>
              {formatInr(savings)}
            </p>
            {savings < 0 && (
              <p className="text-xs text-red-400 mt-0.5">Owed to group</p>
            )}
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Role</p>
            <p className="text-lg font-bold text-gray-900">{member.role}</p>
          </div>
        </div>
      </div>

      {/* Unpaid contributions */}
      {unpaidContributions.length > 0 && (
        <div className="card border-l-4 border-l-red-400">
          <p className="font-semibold text-red-700 mb-2">Unpaid Contributions ({unpaidContributions.length})</p>
          {unpaidContributions.map((c) => (
            <div key={c.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">
                {new Date(c.period.year, c.period.month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" })}
              </span>
              <span className="text-sm font-semibold text-red-500">{formatInr(c.amountPaise)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Active Loans as Borrower */}
      {member.loans.length > 0 && (
        <div className="card">
          <p className="font-semibold text-gray-900 mb-3">Active Loans</p>
          {member.loans.map((loan) => {
            const paidEmis = loan.emis.filter((e) => e.status === "PAID");
            const paidAmount = paidEmis.reduce((s, e) => s + e.amountPaise, 0);
            const outstanding = (loan.principalPaise ?? 0) - paidAmount;
            const pendingEmis = loan.emis.filter((e) => e.status === "PENDING");

            return (
              <Link key={loan.id} href={`/admin/loans/${loan.id}`} className="block bg-gray-50 rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-900">
                    Principal: {formatInr(loan.principalPaise ?? 0)}
                  </span>
                  <span className="badge-disbursed">DISBURSED</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Outstanding: {formatInr(outstanding)}</span>
                  <span>{pendingEmis.length} EMIs left</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Loans as Guarantor */}
      {member.guaranteedLoans.length > 0 && (
        <div className="card">
          <p className="font-semibold text-gray-900 mb-3">Guaranteeing Loans</p>
          {member.guaranteedLoans.map((lg) => {
            const loan = lg.loan;
            const paidEmis = loan.emis.filter((e) => e.status === "PAID");
            const paidAmount = paidEmis.reduce((s, e) => s + e.amountPaise, 0);
            const outstanding = (loan.principalPaise ?? 0) - paidAmount;
            const exposure = outstanding / (loan.guarantors.length || 1);

            return (
              <div key={loan.id} className="bg-amber-50 rounded-xl p-3 mb-2">
                <p className="text-sm font-semibold text-gray-900">Borrower: {loan.user.name}</p>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Outstanding: {formatInr(outstanding)}</span>
                  <span>Exposure: {formatInr(exposure)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Actions */}
      {member.active && (
        <div className="card space-y-3">
          <p className="font-semibold text-gray-900">Admin Actions</p>
          <Link href={`/admin/members/${id}/reset-password`} className="btn-outline block text-center">
            Reset Password
          </Link>
          <DeactivateButton memberId={id} hasActiveLoans={member.loans.length > 0} />
        </div>
      )}
    </div>
  );
}
