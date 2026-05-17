"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { prisma } from "@/lib/db";

export function GroupSetupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/setup-group", {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    setLoading(false);

    if (data.error) {
      setError(data.error);
    } else {
      router.push("/admin/dashboard");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Group Name</label>
        <input name="name" type="text" className="input" required placeholder="e.g. Premier MACS 042" />
      </div>
      <div>
        <label className="label">Monthly Contribution (₹)</label>
        <input name="monthlyContribution" type="number" className="input" defaultValue={1000} min={1} required />
      </div>
      <div>
        <label className="label">Default Interest Rate (% per month)</label>
        <input name="interestRate" type="number" step="0.1" className="input" defaultValue={1} min={0} required />
      </div>
      <div>
        <label className="label">Late Fee (₹)</label>
        <input name="lateFee" type="number" className="input" defaultValue={100} min={0} required />
      </div>
      <div>
        <label className="label">Default Loan Tenure (months)</label>
        <input name="defaultTenure" type="number" className="input" defaultValue={12} min={1} required />
      </div>
      <div>
        <label className="label">EMI Day of Month (1–28)</label>
        <input name="emiDay" type="number" className="input" defaultValue={15} min={1} max={28} required />
      </div>
      <div>
        <label className="label">Minimum Guarantors per Loan</label>
        <input name="minGuarantors" type="number" className="input" defaultValue={1} min={1} required />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Creating…" : "Create Group"}
      </button>
    </form>
  );
}
