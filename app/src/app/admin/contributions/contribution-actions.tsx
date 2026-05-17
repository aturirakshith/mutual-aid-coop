"use client";

import { useState } from "react";
import { markContributionPaid, reverseContribution } from "@/actions/contributions";
import { useRouter } from "next/navigation";

interface ContributionActionsProps {
  contribution: { id: string; status: string };
}

export function ContributionActions({ contribution }: ContributionActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleMarkPaid() {
    setLoading(true);
    await markContributionPaid(contribution.id);
    setLoading(false);
    router.refresh();
  }

  async function handleReverse() {
    const note = prompt("Enter reason for reversal (required):");
    if (!note?.trim()) return;

    setLoading(true);
    const result = await reverseContribution(contribution.id, note);
    setLoading(false);

    if (result.error) alert(result.error);
    else router.refresh();
  }

  if (contribution.status === "PAID") {
    return (
      <button
        onClick={handleReverse}
        disabled={loading}
        className="text-xs text-red-500 font-semibold border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50"
      >
        Reverse
      </button>
    );
  }

  if (contribution.status === "UNPAID") {
    return (
      <button
        onClick={handleMarkPaid}
        disabled={loading}
        className="text-xs text-green-600 font-semibold border border-green-200 rounded-lg px-2 py-1 hover:bg-green-50"
      >
        {loading ? "…" : "Mark Paid"}
      </button>
    );
  }

  return <span className="text-xs text-gray-400">Reversed</span>;
}
