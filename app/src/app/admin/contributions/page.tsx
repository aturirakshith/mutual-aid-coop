import { auth } from "@/lib/auth";
import { getContributionsForPeriod, getCurrentPeriod } from "@/actions/contributions";
import { formatInr } from "@/lib/money";
import { ContributionActions } from "./contribution-actions";

export default async function ContributionsPage() {
  const session = await auth();
  const groupId = session!.user.groupId;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const period = await getContributionsForPeriod(groupId, year, month);
  const monthName = new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

  if (!period) {
    return (
      <div className="p-4">
        <p className="text-gray-500">No contribution period found. Go to Admin Dashboard to initialize.</p>
      </div>
    );
  }

  const contributions = period.contributions ?? [];
  const paidCount = contributions.filter((c) => c.status === "PAID").length;
  const unpaidCount = contributions.filter((c) => c.status === "UNPAID").length;
  const totalExpected = contributions.reduce((s, c) => s + c.amountPaise, 0);
  const outstanding = contributions.filter((c) => c.status !== "PAID").reduce((s, c) => s + c.amountPaise, 0);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Record Contribution</h1>
        <p className="text-sm text-gray-500">{monthName} Collection Cycle</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-xs text-gray-400">Members Paid</p>
          <p className="text-xl font-bold text-brand">{paidCount} / {contributions.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Progress</p>
          <p className="text-xl font-bold text-brand">
            {contributions.length > 0 ? Math.round((paidCount / contributions.length) * 100) : 0}%
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Outstanding</p>
          <p className="text-xl font-bold text-red-500">{formatInr(outstanding)}</p>
        </div>
      </div>

      <div className="card">
        <p className="text-xs text-gray-400 mb-2">Total Expected: <span className="font-semibold text-gray-900">{formatInr(totalExpected)}</span></p>

        {/* Contribution list */}
        <div className="space-y-0">
          {/* Header */}
          <div className="grid grid-cols-[2rem_1fr_auto] gap-2 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-400">ST</span>
            <span className="text-xs font-semibold text-gray-400">MEMBER</span>
            <span className="text-xs font-semibold text-gray-400">ACTIONS</span>
          </div>

          {contributions.map((c) => (
            <div key={c.id} className="grid grid-cols-[2rem_1fr_auto] gap-2 py-3 border-b border-gray-50 items-center">
              <div className={`w-3 h-3 rounded-full ${
                c.status === "PAID" ? "bg-green-400" :
                c.status === "REVERSED" ? "bg-gray-400" :
                "bg-red-400"
              }`} />
              <div>
                <p className="text-sm font-medium text-gray-900">{c.user.name}</p>
                <p className="text-xs text-gray-400">{c.user.mobile}</p>
                {c.paidAt && (
                  <p className="text-xs text-green-500">
                    Paid {new Date(c.paidAt).toLocaleDateString("en-IN")}
                  </p>
                )}
                {c.lateFeePaise > 0 && (
                  <p className="text-xs text-red-400">Late fee: {formatInr(c.lateFeePaise)}</p>
                )}
              </div>
              <ContributionActions contribution={{ id: c.id, status: c.status }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
