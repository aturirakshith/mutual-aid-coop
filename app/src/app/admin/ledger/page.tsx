import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPoolBalance } from "@/actions/loans";
import { formatInr } from "@/lib/money";

export default async function LedgerPage() {
  const session = await auth();
  const groupId = session!.user.groupId;

  const [poolBalance, totalContributions, totalDisbursed, totalEmis] = await Promise.all([
    getPoolBalance(groupId),
    prisma.contribution.aggregate({
      where: { user: { groupId }, status: "PAID" },
      _sum: { amountPaise: true },
    }),
    prisma.loan.aggregate({
      where: { user: { groupId }, status: { in: ["DISBURSED", "CLOSED", "CLOSED_VIA_SETTLEMENT"] } },
      _sum: { disbursalPaise: true },
    }),
    prisma.emi.aggregate({
      where: { loan: { user: { groupId } }, status: "PAID" },
      _sum: { amountPaise: true },
    }),
  ]);

  const activeLoans = await prisma.loan.count({ where: { user: { groupId }, status: "DISBURSED" } });

  const events = await prisma.event.findMany({
    where: { actor: { groupId } },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const eventLabels: Record<string, { label: string; sign: string }> = {
    CONTRIBUTION_PAID: { label: "Contribution", sign: "+" },
    CONTRIBUTION_REVERSED: { label: "Contribution Reversed", sign: "−" },
    LOAN_DISBURSED: { label: "Loan Disbursal", sign: "−" },
    EMI_PAID: { label: "EMI Repayment", sign: "+" },
    SETTLEMENT_APPLIED: { label: "Settlement", sign: "±" },
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Society Ledger</h1>

      {/* Summary cards */}
      <div className="card">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Total Pool Balance</p>
        <p className="text-3xl font-bold text-brand">{formatInr(poolBalance)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs text-gray-400">Total Contributions</p>
          <p className="text-lg font-bold text-gray-900">
            {formatInr(totalContributions._sum.amountPaise ?? 0)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400">Outstanding Loans</p>
          <p className="text-lg font-bold text-gray-900">
            {formatInr(totalDisbursed._sum.disbursalPaise ?? 0)}
            <span className="text-xs text-gray-400 ml-1">{activeLoans} active</span>
          </p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-900">Transaction History</p>
          <span className="text-xs text-gray-400">Last 50</span>
        </div>

        <div className="space-y-0">
          <div className="grid grid-cols-[5rem_1fr_4rem] gap-2 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-400">DATE</span>
            <span className="text-xs font-semibold text-gray-400">DESCRIPTION</span>
            <span className="text-xs font-semibold text-gray-400 text-right">AMOUNT</span>
          </div>

          {events.map((event) => {
            const info = eventLabels[event.kind] ?? { label: event.kind, sign: "" };
            const payload = event.payloadJson as Record<string, unknown>;
            const amount = (payload.amountPaise as number) || (payload.disbursalPaise as number) || 0;

            return (
              <div key={event.id} className="grid grid-cols-[5rem_1fr_4rem] gap-2 py-3 border-b border-gray-50 last:border-0 items-start">
                <div className="text-xs text-gray-400">
                  {new Date(event.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "2-digit",
                  })}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{info.label}</p>
                  <p className="text-xs text-gray-400">{event.actor?.name ?? "System"}</p>
                </div>
                <div className="text-right">
                  {amount > 0 && (
                    <span className={`text-sm font-semibold ${info.sign === "+" ? "text-green-600" : "text-red-500"}`}>
                      {info.sign}{formatInr(amount)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {events.length === 0 && (
            <p className="text-center text-gray-400 py-8">No transactions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
