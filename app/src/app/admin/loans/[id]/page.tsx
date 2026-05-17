import { auth } from "@/lib/auth";
import { getLoanById } from "@/actions/loans";
import { memberSavings, isLoanEligible } from "@/actions/contributions";
import { formatInr } from "@/lib/money";
import { computeLoanTerms, computeFirstEmiDate } from "@/lib/emi";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LoanAdminActions } from "./loan-admin-actions";

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const loan = await getLoanById(id);
  if (!loan || loan.user.groupId !== session!.user.groupId) notFound();

  const borrowerSavings = await memberSavings(loan.userId);
  const eligible = await isLoanEligible(loan.userId);

  const guarantorsWithSavings = await Promise.all(
    loan.guarantors.map(async (g) => ({
      ...g,
      savings: await memberSavings(g.userId),
    })),
  );

  // Compute loan terms for display
  const terms =
    loan.principalPaise && loan.interestRateBps && loan.tenureMonths
      ? computeLoanTerms(loan.principalPaise, loan.interestRateBps, loan.tenureMonths)
      : null;

  const pendingEmis = loan.emis.filter((e) => e.status === "PENDING").sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
  const paidEmis = loan.emis.filter((e) => e.status === "PAID");
  const paidAmount = paidEmis.reduce((s, e) => s + e.amountPaise, 0);
  const outstanding = (loan.principalPaise ?? 0) - paidAmount;

  return (
    <div className="p-4 space-y-4">
      <Link href="/admin/loans" className="text-brand text-sm flex items-center gap-1">
        ← Back to Loans
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Loan Request</h1>
            <p className="text-sm text-gray-500">by {loan.user.name} ({loan.user.mobile})</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            loan.status === "PENDING" ? "bg-amber-100 text-amber-700" :
            loan.status === "APPROVED" ? "bg-blue-100 text-blue-700" :
            loan.status === "DISBURSED" ? "bg-purple-100 text-purple-700" :
            "bg-gray-100 text-gray-600"
          }`}>{loan.status.replace("_", " ")}</span>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400">Requested Amount</p>
            <p className="text-2xl font-bold text-gray-900">{formatInr(loan.requestedAmountPaise)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Requested Tenure</p>
            <p className="font-semibold text-gray-900">{loan.requestedTenure} Months</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Reason</p>
            <p className="text-sm text-gray-700 italic">&ldquo;{loan.reason}&rdquo;</p>
          </div>
        </div>
      </div>

      {/* Guarantor Analysis */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-900">Guarantor Analysis</p>
          <span className="text-xs text-gray-400">{loan.guarantors.length} Proposed</span>
        </div>
        <div className="space-y-2">
          {guarantorsWithSavings.map((g) => (
            <div key={g.userId} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-900">{g.user.name}</p>
                <p className="text-xs text-gray-400">{g.user.mobile}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Savings</p>
                <p className={`text-sm font-semibold ${g.savings < 0 ? "text-red-500" : "text-gray-900"}`}>
                  {formatInr(g.savings)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Borrower Credit Snapshot */}
      <div className="card bg-gray-50">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Borrower Credit Snapshot</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400">Savings Balance</p>
            <p className={`font-semibold ${borrowerSavings < 0 ? "text-red-500" : "text-gray-900"}`}>
              {formatInr(borrowerSavings)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Loan Eligible</p>
            <p className={`font-semibold ${eligible ? "text-green-600" : "text-red-500"}`}>
              {eligible ? "Yes" : "No — Has Unpaid"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Active Loans</p>
            <p className="font-semibold text-gray-900">
              {loan.status === "DISBURSED" ? "1+" : "0"}
            </p>
          </div>
        </div>
      </div>

      {/* Calculated Summary (for approved/disbursed) */}
      {terms && loan.status !== "PENDING" && (
        <div className="card bg-gray-900 text-white">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Calculated Summary</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Total Disbursal</span>
              <span className="font-bold text-lg">{formatInr(terms.disbursalPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Monthly EMI</span>
              <span className="font-semibold">{formatInr(terms.emiPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Total Interest</span>
              <span className="font-semibold">{formatInr(terms.interestPaise)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-2">
              <span className="text-gray-400 text-sm">Total Repayable</span>
              <span className="font-bold">{formatInr(loan.principalPaise ?? 0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* EMI Schedule (for disbursed) */}
      {loan.status === "DISBURSED" && loan.emis.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900">EMI Schedule</p>
            <span className="text-xs text-gray-400">Outstanding: {formatInr(outstanding)}</span>
          </div>
          <div className="space-y-2">
            {loan.emis.sort((a, b) => a.seq - b.seq).map((emi) => (
              <div key={emi.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">EMI {emi.seq}</p>
                  <p className="text-xs text-gray-400">
                    Due {new Date(emi.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{formatInr(emi.amountPaise)}</span>
                  {emi.status === "PAID" ? (
                    <span className="badge-paid">PAID</span>
                  ) : (
                    <EmiPayButton emiId={emi.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Actions */}
      <LoanAdminActions loan={{
        id: loan.id,
        status: loan.status,
        requestedAmountPaise: loan.requestedAmountPaise,
        requestedTenure: loan.requestedTenure,
        guarantorIds: loan.guarantors.map((g) => g.userId),
      }} />
    </div>
  );
}

function EmiPayButton({ emiId }: { emiId: string }) {
  return (
    <form action={async () => {
      "use server";
      const { markEmiPaid } = await import("@/actions/loans");
      await markEmiPaid(emiId);
    }}>
      <button type="submit" className="text-xs text-green-600 font-semibold border border-green-200 rounded-lg px-2 py-1 hover:bg-green-50">
        Mark Paid
      </button>
    </form>
  );
}
