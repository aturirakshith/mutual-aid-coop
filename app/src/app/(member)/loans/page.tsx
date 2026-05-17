import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/money";
import { isLoanEligible } from "@/actions/contributions";
import Link from "next/link";

export default async function MemberLoansPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [loans, eligible] = await Promise.all([
    prisma.loan.findMany({
      where: { userId },
      include: { emis: { orderBy: { seq: "asc" } } },
      orderBy: { requestedAt: "desc" },
    }),
    isLoanEligible(userId),
  ]);

  const activeLoans = loans.filter((l) => l.status === "DISBURSED");
  const pendingLoans = loans.filter((l) => l.status === "PENDING" || l.status === "APPROVED");
  const closedLoans = loans.filter((l) => ["CLOSED", "CLOSED_VIA_SETTLEMENT", "REJECTED"].includes(l.status));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Loans</h1>
        <Link
          href={eligible ? "/loans/new" : "#"}
          className={`text-sm font-bold px-4 py-2 rounded-xl ${
            eligible ? "bg-brand text-white" : "bg-gray-200 text-gray-400"
          }`}
        >
          + Request
        </Link>
      </div>

      {!eligible && (
        <div className="card bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">You have unpaid contributions. Settle them before requesting a new loan.</p>
        </div>
      )}

      {activeLoans.map((loan) => {
        const paidEmis = loan.emis.filter((e) => e.status === "PAID");
        const paidAmount = paidEmis.reduce((s, e) => s + e.amountPaise, 0);
        const outstanding = (loan.principalPaise ?? 0) - paidAmount;
        const nextPending = loan.emis.find((e) => e.status === "PENDING");
        const progress = loan.principalPaise ? Math.round((paidAmount / loan.principalPaise) * 100) : 0;

        return (
          <div key={loan.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-gray-900">Active Loan</p>
              <span className="badge-disbursed">L-{loan.id.slice(-4).toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <p className="text-xs text-gray-400">Principal</p>
                <p className="font-semibold">{formatInr(loan.principalPaise ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Outstanding</p>
                <p className="font-semibold text-brand">{formatInr(outstanding)}</p>
              </div>
              {nextPending && (
                <div>
                  <p className="text-xs text-gray-400">Next EMI Due</p>
                  <p className="font-semibold">
                    {new Date(nextPending.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400">EMI</p>
                <p className="font-semibold">{formatInr(loan.emis[0]?.amountPaise ?? 0)}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
              <div className="h-full bg-brand rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-400">{progress}% of principal repaid</p>

            {/* EMI schedule */}
            <details className="mt-3">
              <summary className="text-xs text-brand font-semibold cursor-pointer">View EMI Schedule</summary>
              <div className="mt-2 space-y-1">
                {loan.emis.map((emi) => (
                  <div key={emi.id} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500">
                      EMI {emi.seq} — {new Date(emi.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{formatInr(emi.amountPaise)}</span>
                      {emi.status === "PAID" ? (
                        <span className="badge-paid">PAID</span>
                      ) : (
                        <span className="badge-pending">DUE</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        );
      })}

      {pendingLoans.map((loan) => (
        <div key={loan.id} className="card border-l-4 border-l-amber-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Loan Request</p>
              <p className="text-sm text-gray-500">{formatInr(loan.requestedAmountPaise)} · {loan.requestedTenure} months</p>
            </div>
            <span className={loan.status === "PENDING" ? "badge-pending" : "badge-approved"}>
              {loan.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Submitted {new Date(loan.requestedAt).toLocaleDateString("en-IN")}</p>
        </div>
      ))}

      {closedLoans.map((loan) => (
        <div key={loan.id} className="card opacity-70">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-700">Closed Loan</p>
              <p className="text-sm text-gray-500">{formatInr(loan.principalPaise ?? 0)}</p>
            </div>
            <span className="badge-closed">{loan.status.replace(/_/g, " ")}</span>
          </div>
          {loan.closedAt && (
            <p className="text-xs text-gray-400 mt-1">Closed {new Date(loan.closedAt).toLocaleDateString("en-IN")}</p>
          )}
        </div>
      ))}

      {loans.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-gray-400 mb-4">You have no loans yet</p>
          {eligible && (
            <Link href="/loans/new" className="btn-primary inline-block px-8 w-auto">
              Request a Loan
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
