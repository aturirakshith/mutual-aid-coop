import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { proposeSettlement } from "@/actions/settlements";
import { formatInr } from "@/lib/money";
import { notFound } from "next/navigation";
import { SettlementConfirmForm } from "./settlement-confirm-form";

export default async function SettlementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const member = await prisma.user.findUnique({
    where: { id, groupId: session!.user.groupId },
    select: { id: true, name: true, mobile: true, active: true },
  });
  if (!member) notFound();

  const { proposals, error } = await proposeSettlement(id);

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600 card">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settlement Workflow</h1>
        <p className="text-sm text-gray-500">
          Reconcile outstanding balances for {member.name} before deactivation. This is irreversible and creates an audit trail.
        </p>
      </div>

      {proposals && proposals.length === 0 ? (
        <div className="card text-center">
          <p className="text-green-700 font-semibold">No outstanding loans. Member can be deactivated directly.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals?.map((proposal) => (
            <div key={proposal.loanId} className="card space-y-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total Outstanding</p>
                <p className="text-3xl font-bold text-gray-900">{formatInr(proposal.outstandingPaise)}</p>
              </div>

              {/* Step 1: Borrower savings */}
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">Step 1: Borrower Savings Applied</p>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500">Available savings</p>
                    <p className="text-lg font-bold text-gray-900">{formatInr(proposal.borrowerSavingsPaise)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Applied to loan</p>
                    <p className="text-lg font-bold text-red-500">(-) {formatInr(proposal.borrowerAppliedPaise)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2 italic">
                  The entire applicable savings will be applied. Borrower savings after: {formatInr(proposal.borrowerSavingsPaise - proposal.borrowerAppliedPaise)}
                </p>
              </div>

              {/* Step 2: Guarantors */}
              {proposal.remainingPaise > 0 && (
                <div className="bg-amber-50 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-semibold text-amber-900">Step 2: Remaining Deficit</p>
                    <p className="text-sm font-bold text-red-600">{formatInr(proposal.remainingPaise)}</p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    To be recovered equally from {proposal.guarantors.length} guarantor{proposal.guarantors.length > 1 ? "s" : ""}.
                  </p>
                  {proposal.guarantors.map((g) => (
                    <div key={g.userId} className="flex justify-between items-center py-2 border-b border-amber-100 last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{g.name}</p>
                        <p className="text-xs text-gray-400">Current savings: {formatInr(g.currentSavings)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-500">-{formatInr(g.proposedDeduction)}</p>
                        {g.currentSavings - g.proposedDeduction < 0 && (
                          <p className="text-xs text-red-400">Goes negative</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <SettlementConfirmForm
            memberId={id}
            memberName={member.name}
            proposals={proposals ?? []}
          />
        </div>
      )}
    </div>
  );
}
