"use client";

import { useRouter } from "next/navigation";
import { deactivateMember } from "@/actions/members";

export function DeactivateButton({
  memberId,
  hasActiveLoans,
}: {
  memberId: string;
  hasActiveLoans: boolean;
}) {
  const router = useRouter();

  async function handleClick() {
    if (!confirm("Deactivate this member?")) return;

    const result = await deactivateMember(memberId);

    if (result?.blocked) {
      alert(result.error);
    } else if (result?.needsSettlement) {
      router.push(`/admin/members/${memberId}/settlement`);
    } else if (result?.error) {
      alert(result.error);
    } else {
      router.push("/admin/members");
    }
  }

  return (
    <button onClick={handleClick} className="btn-danger w-full">
      {hasActiveLoans ? "Deactivate (Run Settlement)" : "Deactivate Member"}
    </button>
  );
}
