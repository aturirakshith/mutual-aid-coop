"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { submitLoanRequest } from "@/actions/loans";
import { formatInr } from "@/lib/money";
import Link from "next/link";

interface Member {
  id: string;
  name: string;
  mobile: string;
}

export default function LoanRequestPage() {
  const router = useRouter();
  const [amountRs, setAmountRs] = useState("50000");
  const [tenure, setTenure] = useState(12);
  const [reason, setReason] = useState("");
  const [guarantors, setGuarantors] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const principalPaise = Math.round(parseFloat(amountRs || "0") * 100);
  const interestRateBps = 100; // 1% per month default
  const interestPaise = Math.round(principalPaise * (interestRateBps / 10000) * tenure);
  const emiPaise = principalPaise > 0 && tenure > 0 ? Math.floor(principalPaise / tenure) : 0;
  const totalPayable = principalPaise;

  useEffect(() => {
    if (memberSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/members/search?q=${encodeURIComponent(memberSearch)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setSearchResults(data.members ?? []))
      .catch(() => {});

    return () => controller.abort();
  }, [memberSearch]);

  function addGuarantor(member: Member) {
    if (guarantors.find((g) => g.id === member.id)) return;
    setGuarantors([...guarantors, member]);
    setMemberSearch("");
    setSearchResults([]);
  }

  function removeGuarantor(id: string) {
    setGuarantors(guarantors.filter((g) => g.id !== id));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!reason.trim()) {
      setError("Please provide a reason for the loan");
      return;
    }
    if (guarantors.length === 0) {
      setError("Please add at least one guarantor");
      return;
    }

    setLoading(true);
    const result = await submitLoanRequest({
      amountPaise: principalPaise,
      tenureMonths: tenure,
      reason,
      guarantorIds: guarantors.map((g) => g.id),
    });
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="p-4">
      <Link href="/dashboard" className="text-brand text-sm flex items-center gap-1 mb-4">
        ← Back to Dashboard
      </Link>

      <div className="card mb-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Loan Application</h1>
        <p className="text-sm text-gray-500 mb-6">
          Please fill out the details below to submit your credit request for review.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Amount */}
          <div>
            <label className="label">Loan Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
              <input
                type="number"
                value={amountRs}
                onChange={(e) => setAmountRs(e.target.value)}
                className="input pl-8"
                placeholder="50000"
                min={1}
                required
              />
            </div>
          </div>

          {/* Tenure slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Tenure (Months)</label>
              <span className="text-brand font-bold text-sm">{tenure} Months</span>
            </div>
            <input
              type="range"
              min={6}
              max={60}
              value={tenure}
              onChange={(e) => setTenure(parseInt(e.target.value))}
              className="w-full accent-brand"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>6m</span>
              <span>60m</span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="label">Reason for Loan</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input min-h-[80px] resize-none"
              placeholder="e.g. Agricultural investment, Medical emergency..."
              required
            />
          </div>

          {/* Guarantors */}
          <div>
            <label className="label">Proposed Guarantors (Min 1)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="input flex-1"
                placeholder="Search by member name or mobile"
              />
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="border border-gray-200 rounded-xl mt-1 overflow-hidden shadow-sm">
                {searchResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addGuarantor(m)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-brand/5 border-b border-gray-50 last:border-0"
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-gray-400 ml-2">{m.mobile}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected guarantors */}
            <div className="flex flex-wrap gap-2 mt-2">
              {guarantors.map((g) => (
                <span
                  key={g.id}
                  className="flex items-center gap-1 bg-brand/10 text-brand text-xs font-semibold px-3 py-1 rounded-full"
                >
                  {g.name}
                  <button type="button" onClick={() => removeGuarantor(g.id)} className="ml-1 hover:text-red-500">
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* EMI Estimate */}
          {principalPaise > 0 && (
            <div className="bg-brand rounded-2xl p-5 text-white">
              <p className="text-xs text-blue-200 uppercase tracking-wide mb-2">EMI Estimate</p>
              <p className="text-4xl font-bold">{formatInr(emiPaise)}</p>
              <p className="text-blue-200 text-xs mt-1">Estimated Monthly Payment</p>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-200">Total Principal</span>
                  <span className="font-semibold">{formatInr(principalPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-200">Total Interest (1%/mo)</span>
                  <span className="font-semibold">{formatInr(interestPaise)}</span>
                </div>
                <div className="flex justify-between border-t border-blue-400 pt-2 mt-2">
                  <span className="font-semibold">Total Payable</span>
                  <span className="font-bold">{formatInr(totalPayable)}</span>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full mt-4 bg-white text-brand font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50">
                {loading ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          )}
        </form>
      </div>

      <div className="card">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Required Documents</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-green-500">✓</span> Last 3 months payslips
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-green-500">✓</span> Guarantor Authorization
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>○</span> Bank Statement (XLS/PDF)
          </div>
        </div>
      </div>
    </div>
  );
}
