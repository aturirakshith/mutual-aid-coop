"use client";

import { useState, FormEvent } from "react";
import { resetPassword } from "@/actions/members";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = form.get("newPassword") as string;
    const confirm = form.get("confirmPassword") as string;

    if (newPassword !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    const result = await resetPassword(memberId, newPassword);
    setLoading(false);

    if (result.error) {
      setError(result.error as string);
    } else {
      alert("Password reset successfully. Member will be prompted to change it on next login.");
      router.push(`/admin/members/${memberId}`);
    }
  }

  return (
    <div className="p-4">
      <Link href={`/admin/members/${memberId}`} className="text-brand text-sm flex items-center gap-1 mb-4">
        ← Back
      </Link>

      <div className="card">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Reset Password</h1>
        <p className="text-sm text-gray-500 mb-6">Member will be required to change this on next login.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">New Password</label>
            <input name="newPassword" type="password" className="input" minLength={6} required placeholder="Minimum 6 characters" />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input name="confirmPassword" type="password" className="input" minLength={6} required placeholder="Repeat password" />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Resetting…" : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
