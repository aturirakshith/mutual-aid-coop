import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPoolBalance, getPendingLoans } from "@/actions/loans";
import { getCurrentPeriod } from "@/actions/contributions";
import { formatInr } from "@/lib/money";
import Link from "next/link";

export default async function AdminDashboard() {
  const session = await auth();
  const groupId = session!.user.groupId;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 mb-4">No group configured yet.</p>
        <Link href="/admin/settings" className="btn-primary">
          Set up your group
        </Link>
      </div>
    );
  }

  const [poolBalance, pendingLoans, activeLoans, period] = await Promise.all([
    getPoolBalance(groupId),
    getPendingLoans(groupId),
    prisma.loan.count({ where: { user: { groupId }, status: "DISBURSED" } }),
    getCurrentPeriod(groupId),
  ]);

  const now = new Date();
  const monthName = now.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

  // Contribution stats for current period
  const contributions = await prisma.contribution.findMany({
    where: { periodId: period.id },
  });
  const paidCount = contributions.filter((c) => c.status === "PAID").length;
  const totalCount = contributions.length;
  const paidPct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  const activeLoanVolume = await prisma.loan.aggregate({
    where: { user: { groupId }, status: "DISBURSED" },
    _sum: { principalPaise: true },
  });

  const membersWithNegativeSavings = 0; // computed via memberSavings() — simplified here

  const pendingSettlements = await prisma.user.count({
    where: {
      groupId,
      active: false,
      loans: { some: { status: "DISBURSED" } },
    },
  });

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Executive Overview</h1>
        <p className="text-gray-400 text-xs mt-0.5">
          {now.toLocaleString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata"
          })}
        </p>
      </div>

      {/* Pool Balance */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pool Balance</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{formatInr(poolBalance)}</p>
          </div>
          <span className="text-2xl">🏦</span>
        </div>
      </div>

      {/* Active Loans */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Active Loans</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{activeLoans}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Total Volume: {formatInr(activeLoanVolume._sum.principalPaise ?? 0)}
            </p>
          </div>
          <span className="text-2xl">💳</span>
        </div>
      </div>

      {/* Pending Requests */}
      <div className={`card border-l-4 ${pendingLoans.length > 0 ? "border-l-red-400" : "border-l-green-400"}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pending Requests</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{pendingLoans.length}</p>
            {pendingLoans.length > 0 && (
              <p className="text-xs text-red-500 font-semibold mt-0.5">Requires immediate review</p>
            )}
          </div>
          <span className="text-2xl">📋</span>
        </div>
      </div>

      {/* Contribution Snapshot */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Monthly Contribution Snapshot</h2>
          <span className="bg-brand text-white text-xs font-bold px-3 py-1 rounded-lg">
            {monthName}
          </span>
        </div>

        {/* Progress circle (CSS-only) */}
        <div className="flex justify-center my-4">
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="#e5e7eb" strokeWidth="8" fill="none" />
              <circle
                cx="50" cy="50" r="40"
                stroke="#1a237e" strokeWidth="8" fill="none"
                strokeDasharray={`${paidPct * 2.51} 251`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-gray-900">{paidPct}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">PAID</p>
            <p className="text-lg font-bold text-brand">{paidCount} / {totalCount}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">UNPAID</p>
            <p className="text-lg font-bold text-red-500">{totalCount - paidCount}</p>
          </div>
        </div>
      </div>

      {/* Urgent Actions */}
      {(pendingLoans.length > 0 || pendingSettlements > 0) && (
        <div className="card border border-amber-200 bg-amber-50">
          <p className="font-semibold text-amber-800 mb-3">⚠ Urgent Actions</p>
          <div className="space-y-2">
            {pendingLoans.length > 0 && (
              <Link href="/admin/loans" className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Review {pendingLoans.length} Loan Request{pendingLoans.length > 1 ? "s" : ""}</p>
                  <p className="text-xs text-gray-400">
                    {pendingLoans.slice(0, 2).map((l) => l.user.name).join(", ")}
                    {pendingLoans.length > 2 && ` and ${pendingLoans.length - 2} other${pendingLoans.length - 2 > 1 ? "s" : ""}`}
                  </p>
                </div>
                <span className="text-gray-400">›</span>
              </Link>
            )}
            {pendingSettlements > 0 && (
              <Link href="/admin/members" className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Handle {pendingSettlements} Pending Settlement{pendingSettlements > 1 ? "s" : ""}</p>
                  <p className="text-xs text-gray-400">Active loans outstanding on deactivated members</p>
                </div>
                <span className="text-gray-400">›</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="card">
        <p className="font-semibold text-gray-900 mb-3">Quick Links</p>
        <div className="space-y-2">
          <Link href="/admin/members/new" className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 hover:bg-gray-100">
            <span className="text-xl">👤</span>
            <span className="text-sm font-medium text-gray-900">Add Member</span>
          </Link>
          <Link href="/admin/contributions" className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 hover:bg-gray-100">
            <span className="text-xl">💸</span>
            <span className="text-sm font-medium text-gray-900">Record Contribution</span>
          </Link>
          <Link href="/admin/ledger" className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 hover:bg-gray-100">
            <span className="text-xl">📊</span>
            <span className="text-sm font-medium text-gray-900">View Ledger</span>
          </Link>
          <Link href="/admin/settings" className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 hover:bg-gray-100">
            <span className="text-xl">⚙️</span>
            <span className="text-sm font-medium text-gray-900">Group Settings</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
