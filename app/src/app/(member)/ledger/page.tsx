import { auth } from "@/lib/auth";
import { getMemberLedger } from "@/actions/ledger";
import { getPoolBalance } from "@/actions/loans";
import { memberSavings } from "@/actions/contributions";
import { formatInr } from "@/lib/money";

export default async function MemberLedgerPage() {
  const session = await auth();
  const userId = session!.user.id;
  const groupId = session!.user.groupId;

  const [ledger, poolBalance, savings] = await Promise.all([
    getMemberLedger(userId),
    getPoolBalance(groupId),
    memberSavings(userId),
  ]);

  // Merge and sort by date
  type LedgerEntry = {
    id: string;
    date: Date;
    type: "contribution" | "loan" | "emi" | "settlement";
    label: string;
    amountPaise: number;
    sign: "+" | "−";
    note?: string;
  };

  const entries: LedgerEntry[] = [
    ...ledger.contributions.map((c) => ({
      id: c.id,
      date: c.createdAt,
      type: "contribution" as const,
      label: `Contribution — ${new Date(c.period.year, c.period.month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" })}`,
      amountPaise: c.amountPaise,
      sign: c.status === "PAID" ? "+" : "−" as "+" | "−",
      note: c.note ?? undefined,
    })),
    ...ledger.loans.map((l) => ({
      id: l.id,
      date: l.disbursedAt ?? l.requestedAt,
      type: "loan" as const,
      label: `Loan ${l.status === "DISBURSED" ? "Disbursed" : l.status}`,
      amountPaise: l.disbursalPaise ?? 0,
      sign: "−" as "+" | "−",
    })),
    ...ledger.emis.map((e) => ({
      id: e.id,
      date: e.paidAt ?? e.dueDate,
      type: "emi" as const,
      label: `EMI Repayment (EMI ${e.seq} of ${e.loan.tenureMonths})`,
      amountPaise: e.amountPaise,
      sign: "+" as "+" | "−",
    })),
    ...ledger.settlements.map((s) => ({
      id: s.id,
      date: s.settlement.triggeredAt,
      type: "settlement" as const,
      label: `Settlement — Loan by ${s.settlement.loan.user.name}`,
      amountPaise: s.appliedPaise,
      sign: "−" as "+" | "−",
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs text-gray-400">My Savings</p>
          <p className={`text-xl font-bold ${savings < 0 ? "text-red-500" : "text-gray-900"}`}>
            {formatInr(savings)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400">Pool Balance</p>
          <p className="text-xl font-bold text-brand">{formatInr(poolBalance)}</p>
        </div>
      </div>

      {/* Transaction list */}
      <div className="card">
        <div className="space-y-0">
          <div className="grid grid-cols-[4rem_1fr_4rem] gap-2 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-400">DATE</span>
            <span className="text-xs font-semibold text-gray-400">DESCRIPTION</span>
            <span className="text-xs font-semibold text-gray-400 text-right">AMOUNT</span>
          </div>

          {entries.map((entry) => (
            <div key={`${entry.type}-${entry.id}`} className="grid grid-cols-[4rem_1fr_4rem] gap-2 py-3 border-b border-gray-50 last:border-0 items-start">
              <span className="text-xs text-gray-400">
                {entry.date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">{entry.label}</p>
                {entry.note && <p className="text-xs text-gray-400">{entry.note}</p>}
              </div>
              <span className={`text-sm font-semibold text-right ${entry.sign === "+" ? "text-green-600" : "text-red-500"}`}>
                {entry.sign}{formatInr(entry.amountPaise)}
              </span>
            </div>
          ))}

          {entries.length === 0 && (
            <p className="text-center text-gray-400 py-8">No transactions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
