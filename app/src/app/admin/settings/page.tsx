import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/money";
import { GroupSetupForm } from "./group-setup-form";

export default async function SettingsPage() {
  const session = await auth();
  const groupId = session!.user.groupId;

  const group = groupId ? await prisma.group.findUnique({ where: { id: groupId } }) : null;

  if (!group) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Group Settings</h1>
        <p className="text-sm text-gray-500 mb-6">Initial setup — configure your cooperative society.</p>
        <GroupSetupForm />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Group Settings</h1>
        <p className="text-sm text-gray-500">Core configuration for {group.name}</p>
      </div>

      <div className="card bg-amber-50 border border-amber-200">
        <p className="text-sm font-semibold text-amber-800">🔒 Immutable Parameters</p>
        <p className="text-xs text-amber-700 mt-1">
          These rules are locked after group creation to prevent administrative fraud and ensure long-term stability.
        </p>
      </div>

      <div className="card space-y-5">
        <p className="font-semibold text-gray-900">Society Charter Rules</p>

        <Field label="Group Name" value={group.name} />
        <Field label="Monthly Contribution (₹)" value={formatInr(group.monthlyContributionPaise)} />
        <Field
          label="Default Interest Rate"
          value={`${(group.defaultInterestRateBps / 100).toFixed(2)}% / month`}
        />
        <Field label="Default Loan Tenure" value={`${group.defaultTenureMonths} Months`} />
        <Field label="Late Fee" value={formatInr(group.lateFeePassse)} />
        <Field label="EMI Day of Month (1–28)" value={`Day ${group.emiDayOfMonth}`} />
        <Field label="Min Guarantors Per Loan" value={`${group.minGuarantorsPerLoan} Members`} />
      </div>

      <div className="card text-center">
        <p className="text-xs text-gray-400">Changes to these fields require a General Body Resolution.</p>
        <p className="text-xs text-gray-400 mt-1">Contact your regional admin for Charter Re-validation.</p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
