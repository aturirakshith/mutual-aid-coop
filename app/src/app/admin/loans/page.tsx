import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/money";
import Link from "next/link";

export default async function AdminLoansPage() {
  const session = await auth();
  const groupId = session!.user.groupId;

  const loans = await prisma.loan.findMany({
    where: { user: { groupId } },
    include: {
      user: { select: { id: true, name: true, mobile: true } },
      guarantors: { include: { user: { select: { name: true } } } },
      emis: true,
    },
    orderBy: { requestedAt: "desc" },
  });

  const pending = loans.filter((l) => l.status === "PENDING");
  const active = loans.filter((l) => l.status === "DISBURSED");
  const other = loans.filter((l) => !["PENDING", "DISBURSED"].includes(l.status));

  function LoanCard({ loan }: { loan: (typeof loans)[0] }) {
    const paidEmis = loan.emis.filter((e) => e.status === "PAID");
    const paidAmount = paidEmis.reduce((s, e) => s + e.amountPaise, 0);
    const outstanding = (loan.principalPaise ?? loan.requestedAmountPaise) - paidAmount;
    const pendingEmis = loan.emis.filter((e) => e.status === "PENDING");
    const nextEmi = pendingEmis.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

    const statusClass: Record<string, string> = {
      PENDING: "badge-pending",
      APPROVED: "badge-approved",
      DISBURSED: "badge-disbursed",
      CLOSED: "badge-closed",
      CLOSED_VIA_SETTLEMENT: "badge-closed",
      REJECTED: "bg-red-100 text-red-500 text-xs font-bold px-2 py-0.5 rounded-full",
    };

    return (
      <Link href={`/admin/loans/${loan.id}`} className="card block hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-semibold text-gray-900">{loan.user.name}</p>
            <p className="text-xs text-gray-400">{loan.user.mobile}</p>
          </div>
          <span className={statusClass[loan.status] ?? "badge-pending"}>{loan.status.replace("_", " ")}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-gray-400">Amount</p>
            <p className="font-semibold text-gray-900">{formatInr(loan.principalPaise ?? loan.requestedAmountPaise)}</p>
          </div>
          {loan.status === "DISBURSED" && (
            <div>
              <p className="text-gray-400">Outstanding</p>
              <p className="font-semibold text-brand">{formatInr(outstanding)}</p>
            </div>
          )}
          {nextEmi && (
            <div>
              <p className="text-gray-400">Next EMI</p>
              <p className="font-semibold text-gray-900">
                {new Date(nextEmi.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            </div>
          )}
          <div>
            <p className="text-gray-400">Requested</p>
            <p className="font-semibold text-gray-900">
              {new Date(loan.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
            </p>
          </div>
        </div>
        {loan.guarantors.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            Guarantors: {loan.guarantors.map((g) => g.user.name).join(", ")}
          </p>
        )}
      </Link>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Loans</h1>

      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-2">
            Pending Review ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((l) => <LoanCard key={l.id} loan={l} />)}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-2">
            Active / Disbursed ({active.length})
          </h2>
          <div className="space-y-3">
            {active.map((l) => <LoanCard key={l.id} loan={l} />)}
          </div>
        </section>
      )}

      {other.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            History ({other.length})
          </h2>
          <div className="space-y-3">
            {other.map((l) => <LoanCard key={l.id} loan={l} />)}
          </div>
        </section>
      )}

      {loans.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-gray-400">No loan requests yet</p>
        </div>
      )}
    </div>
  );
}
