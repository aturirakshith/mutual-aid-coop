"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveLoan, rejectLoan, disburseLoan } from "@/actions/loans";
import { computeLoanTerms, computeFirstEmiDate } from "@/lib/emi";
import { formatInr } from "@/lib/money";

interface LoanAdminActionsProps {
  loan: {
    id: string;
    status: string;
    requestedAmountPaise: number;
    requestedTenure: number;
    guarantorIds: string[];
  };
}

export function LoanAdminActions({ loan }: LoanAdminActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [principal, setPrincipal] = useState(String(loan.requestedAmountPaise / 100));
  const [interestRate, setInterestRate] = useState("1");
  const [tenure, setTenure] = useState(String(loan.requestedTenure));

  const principalPaise = Math.round(parseFloat(principal) * 100);
  const interestRateBps = Math.round(parseFloat(interestRate) * 100);
  const tenureMonths = parseInt(tenure);

  const terms =
    principalPaise > 0 && interestRateBps >= 0 && tenureMonths > 0
      ? computeLoanTerms(principalPaise, interestRateBps, tenureMonths)
      : null;

  async function handleApprove() {
    setLoading(true);
    const firstEmiDate = computeFirstEmiDate(new Date(), 15); // default EMI day 15

    const result = await approveLoan({
      loanId: loan.id,
      principalPaise,
      interestRateBps,
      tenureMonths,
      firstEmiDate,
      guarantorIds: loan.guarantorIds,
    });

    setLoading(false);
    if (result.error) alert(result.error);
    else router.refresh();
  }

  async function handleReject() {
    const reason = prompt("Rejection reason (optional):");
    setLoading(true);
    await rejectLoan(loan.id, reason ?? "");
    setLoading(false);
    router.push("/admin/loans");
  }

  async function handleDisburse() {
    if (!confirm("Confirm loan has been disbursed physically?")) return;
    setLoading(true);
    const result = await disburseLoan(loan.id);
    setLoading(false);
    if (result.error) alert(result.error);
    else router.refresh();
  }

  if (loan.status === "PENDING") {
    return (
      <div className="space-y-3">
        {!showApproveForm ? (
          <button
            onClick={() => setShowApproveForm(true)}
            className="btn-primary"
          >
            Review & Approve
          </button>
        ) : (
          <div className="card space-y-4">
            <p className="font-semibold text-gray-900">Approval Decision Form</p>

            <div>
              <label className="label">Final Approved Principal (₹)</label>
              <input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="input"
                min={1}
              />
            </div>

            <div>
              <label className="label">Interest Rate (% / month)</label>
              <input
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="input"
                step="0.1"
                min={0}
              />
            </div>

            <div>
              <label className="label">Tenure (Months)</label>
              <input
                type="number"
                value={tenure}
                onChange={(e) => setTenure(e.target.value)}
                className="input"
                min={1}
                max={120}
              />
            </div>

            {/* Live calculation preview */}
            {terms && (
              <div className="bg-gray-900 text-white rounded-xl p-4 space-y-2">
                <p className="text-xs text-gray-400 uppercase">Calculated Summary</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Disbursal</span>
                  <span className="font-bold text-xl">{formatInr(terms.disbursalPaise)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Monthly EMI</span>
                  <span className="font-semibold">{formatInr(terms.emiPaise)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Interest</span>
                  <span>{formatInr(terms.interestPaise)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                  <span className="text-gray-400">Total Repayable</span>
                  <span className="font-semibold">{formatInr(principalPaise)}</span>
                </div>
              </div>
            )}

            <button onClick={handleApprove} disabled={loading} className="btn-primary">
              {loading ? "Processing…" : "✓ Approve & Confirm"}
            </button>
          </div>
        )}

        <button onClick={handleReject} disabled={loading} className="btn-danger">
          ✕ Reject Application
        </button>
      </div>
    );
  }

  if (loan.status === "APPROVED") {
    return (
      <button onClick={handleDisburse} disabled={loading} className="btn-primary">
        {loading ? "Processing…" : "✓ Mark as Disbursed"}
      </button>
    );
  }

  return null;
}
