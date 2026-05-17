"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmSettlement } from "@/actions/settlements";
import type { SettlementProposal } from "@/actions/settlements";
import { formatInr } from "@/lib/money";

export function SettlementConfirmForm({
  memberId,
  memberName,
  proposals,
}: {
  memberId: string;
  memberName: string;
  proposals: SettlementProposal[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (
      !confirm(
        `Confirm settlement for ${memberName}? This will close all active loans and deactivate the member. This action is irreversible.`,
      )
    )
      return;

    setLoading(true);
    setError("");

    const result = await confirmSettlement({
      memberId,
      settlements: proposals.map((p) => ({
        loanId: p.loanId,
        borrowerAppliedPaise: p.borrowerAppliedPaise,
        guarantorAllocations: p.guarantors.map((g) => ({
          userId: g.userId,
          appliedPaise: g.proposedDeduction,
        })),
      })),
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push("/admin/members");
    }
  }

  const totalOutstanding = proposals.reduce((s, p) => s + p.outstandingPaise, 0);

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="card bg-gray-800 text-white">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Exit Balance for Group</p>
        <p className="text-2xl font-bold mt-1">{formatInr(totalOutstanding)}</p>
        <p className="text-xs text-gray-400 mt-1">Total loans being closed via settlement</p>
      </div>

      <button
        onClick={handleConfirm}
        disabled={loading}
        className="btn-danger"
      >
        {loading ? "Processing…" : "Confirm Settlement & Deactivate"}
      </button>

      <button
        onClick={() => router.back()}
        className="btn-outline"
      >
        Cancel
      </button>
    </div>
  );
}
