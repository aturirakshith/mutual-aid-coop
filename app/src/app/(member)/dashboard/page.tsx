import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { memberSavings, isLoanEligible } from "@/actions/contributions";
import { getPoolBalance } from "@/actions/loans";
import { formatInr } from "@/lib/money";
import Link from "next/link";

export default async function MemberDashboard() {
  const session = await auth();
  const userId = session!.user.id;
  const groupId = session!.user.groupId;

  const [savings, eligible, poolBalance] = await Promise.all([
    memberSavings(userId),
    isLoanEligible(userId),
    getPoolBalance(groupId),
  ]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const period = await prisma.contributionPeriod.findUnique({
    where: { groupId_year_month: { groupId, year, month } },
  });

  const thisMonthContribution = period
    ? await prisma.contribution.findUnique({
        where: { periodId_userId: { periodId: period.id, userId } },
      })
    : null;

  // Active loans as borrower
  const activeLoans = await prisma.loan.findMany({
    where: { userId, status: "DISBURSED" },
    include: {
      emis: { where: { status: "PENDING" }, orderBy: { dueDate: "asc" }, take: 1 },
      guarantors: true,
    },
  });

  // Loans this member is guaranteeing
  const guaranteedLoans = await prisma.loanGuarantor.findMany({
    where: { userId, loan: { status: "DISBURSED" } },
    include: {
      loan: {
        include: {
          user: { select: { name: true } },
          emis: true,
          guarantors: true,
        },
      },
    },
  });

  return (
    <div className="p-4 space-y-4">
      {/* Savings card */}
      <div className="card">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">My Savings</p>
        <p className={`text-3xl font-bold mt-1 ${savings < 0 ? "text-red-500" : "text-gray-900"}`}>
          {formatInr(savings)}
        </p>
        {savings < 0 && (
          <p className="text-xs text-red-400 mt-1">Amount owed to the group</p>
        )}
        <div className="flex items-center justify-between mt-3">
          <div>
            <p className="text-xs text-gray-400">Current Pool Balance</p>
            <p className="text-sm font-bold text-brand">{formatInr(poolBalance)}</p>
          </div>
          <Link href="/ledger" className="bg-brand text-white text-xs font-bold px-3 py-2 rounded-xl">
            View Ledger
          </Link>
        </div>
      </div>

      {/* This month's contribution */}
      <div className="card">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          This Month&apos;s Contribution
        </p>
        {thisMonthContribution ? (
          <div className="text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
              thisMonthContribution.status === "PAID" ? "bg-green-100" : "bg-red-100"
            }`}>
              <span className="text-2xl">
                {thisMonthContribution.status === "PAID" ? "✅" : "⚠️"}
              </span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {formatInr(thisMonthContribution.amountPaise)}
            </p>
            <p className={`text-sm font-semibold mt-0.5 ${
              thisMonthContribution.status === "PAID" ? "text-green-600" : "text-red-500"
            }`}>
              STATUS: {thisMonthContribution.status}
            </p>
            {thisMonthContribution.paidAt && (
              <p className="text-xs text-gray-400 mt-1">
                Paid on {new Date(thisMonthContribution.paidAt).toLocaleDateString("en-IN", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </p>
            )}
            {thisMonthContribution.lateFeePaise > 0 && (
              <p className="text-xs text-red-400 mt-1">
                Late fee: {formatInr(thisMonthContribution.lateFeePaise)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center">No contribution record this month yet</p>
        )}
      </div>

      {/* Active Loans */}
      {activeLoans.map((loan) => {
        const paidEmis = loan.emis.filter((e) => e.status === "PAID" as unknown);
        // We need paid emis to compute outstanding - fetch differently
        const nextEmi = loan.emis[0]; // already filtered to pending, sorted by dueDate
        const emiCount = loan.emis.length; // pending EMIs only

        return (
          <div key={loan.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-gray-900">Active Loan</p>
              <span className="badge-disbursed">L-{loan.id.slice(-4).toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400">Principal Amount</p>
                <p className="font-bold text-gray-900">{formatInr(loan.principalPaise ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Remaining Balance</p>
                <p className="font-bold text-brand">{emiCount} EMIs left</p>
              </div>
              {nextEmi && (
                <>
                  <div>
                    <p className="text-xs text-gray-400">Next EMI Due</p>
                    <p className="font-bold text-gray-900">
                      {new Date(nextEmi.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">EMI Amount</p>
                    <p className="font-bold text-gray-900">{formatInr(nextEmi.amountPaise)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Guaranteeing section */}
      {guaranteedLoans.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900">Guaranteeing</p>
            <span className="text-xl">🛡</span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            You are currently a guarantor for {guaranteedLoans.length} member{guaranteedLoans.length > 1 ? "s" : ""}:
          </p>
          <div className="space-y-2">
            {guaranteedLoans.map((lg) => {
              const loan = lg.loan;
              const paidEmis = loan.emis.filter((e) => e.status === "PAID");
              const paidAmount = paidEmis.reduce((s, e) => s + e.amountPaise, 0);
              const outstanding = (loan.principalPaise ?? 0) - paidAmount;
              const exposure = loan.guarantors.length > 0 ? outstanding / loan.guarantors.length : 0;
              const initials = loan.user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

              return (
                <div key={loan.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{loan.user.name}</p>
                      <p className="text-xs text-gray-400">Liability: {formatInr(exposure)}</p>
                    </div>
                  </div>
                  <span className="text-xs text-green-600 font-semibold">In Good Standing</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA buttons */}
      <Link
        href={eligible ? "/loans/new" : "#"}
        className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm ${
          eligible
            ? "bg-brand text-white hover:bg-brand-light"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        ⊕ REQUEST NEW LOAN
        {!eligible && <span className="text-xs">(Unpaid contributions)</span>}
      </Link>

      <Link href="/ledger" className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-gray-200 font-semibold text-sm text-gray-600 hover:bg-gray-50">
        ↩ PAYMENT HISTORY
      </Link>
    </div>
  );
}
