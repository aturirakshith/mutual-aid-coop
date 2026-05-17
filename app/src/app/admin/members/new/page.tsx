"use client";

import { useState, FormEvent } from "react";
import { addMember } from "@/actions/members";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AddMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await addMember(new FormData(e.currentTarget));
    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      router.push("/admin/members");
    }
  }

  return (
    <div className="p-4">
      <Link href="/admin/members" className="text-brand text-sm flex items-center gap-1 mb-4">
        ← Back to Members
      </Link>

      <div className="card">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Add New Member</h1>
        <p className="text-sm text-gray-500 mb-6">Register a new member into the MACS system.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Full Name</label>
            <input
              name="name"
              type="text"
              className="input"
              placeholder="e.g. Arjun Srinivasan"
              required
              minLength={2}
            />
          </div>

          <div>
            <label className="label">Mobile Number (Username)</label>
            <input
              name="mobile"
              type="tel"
              className="input"
              placeholder="10-digit mobile number"
              maxLength={10}
              pattern="[0-9]{10}"
              required
            />
            <p className="text-xs text-gray-400 mt-1 italic">
              This will be the primary login identifier.
            </p>
          </div>

          <div>
            <label className="label">Initial Password</label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                className="input pr-10"
                placeholder="Minimum 6 characters"
                minLength={6}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Member Access Level</label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 border-2 border-brand rounded-xl p-3 cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                <input type="radio" name="role" value="MEMBER" defaultChecked className="accent-brand" />
                <span className="text-sm font-medium text-gray-900">Standard</span>
              </label>
              <label className="flex items-center gap-2 border-2 border-gray-200 rounded-xl p-3 cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                <input type="radio" name="role" value="ADMIN" className="accent-brand" />
                <span className="text-sm font-medium text-gray-900">Administrator</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Adding…" : "Add Member"}
          </button>

          <Link href="/admin/members" className="btn-outline block text-center">
            Cancel
          </Link>
        </form>
      </div>
    </div>
  );
}
