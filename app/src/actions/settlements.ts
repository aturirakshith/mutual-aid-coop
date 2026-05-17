"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getLoanOutstanding } from "@/actions/loans";
import { memberSavings } from "@/actions/contributions";

export interface SettlementProposal {
  loanId: string;
  outstandingPaise: number;
  borrowerSavingsPaise: number;
  borrowerAppliedPaise: number;
  remainingPaise: number;
  guarantors: Array<{
    userId: string;
    name: string;
    currentSavings: number;
    proposedDeduction: number;
  }>;
}

export async function proposeSettlement(memberId: string): Promise<{
  proposals?: SettlementProposal[];
  error?: string;
}> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return { error: "Unauthorized" };

  const loans = await prisma.loan.findMany({
    where: { userId: memberId, status: "DISBURSED" },
    include: {
      guarantors: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  if (loans.length === 0) return { proposals: [] };

  const borrowerSavings = await memberSavings(memberId);

  const proposals: SettlementProposal[] = [];

  for (const loan of loans) {
    const outstanding = await getLoanOutstanding(loan.id);
    if (outstanding === 0) continue;

    // Step 1: apply borrower savings (capped at outstanding, borrower savings can't go below 0)
    const borrowerApplied = Math.min(Math.max(0, borrowerSavings), outstanding);
    const remaining = outstanding - borrowerApplied;

    // Step 2: split remaining equally across guarantors
    const numGuarantors = loan.guarantors.length;
    const perGuarantorBase = numGuarantors > 0 ? Math.floor(remaining / numGuarantors) : 0;
    let distributed = 0;

    const guarantorsWithProposal = await Promise.all(
      loan.guarantors.map(async (g, idx) => {
        const savings = await memberSavings(g.userId);
        // Last guarantor absorbs rounding difference
        const isLast = idx === loan.guarantors.length - 1;
        const deduction = isLast ? remaining - distributed : perGuarantorBase;
        distributed += isLast ? 0 : deduction;
        return {
          userId: g.userId,
          name: g.user.name,
          currentSavings: savings,
          proposedDeduction: deduction,
        };
      }),
    );

    proposals.push({
      loanId: loan.id,
      outstandingPaise: outstanding,
      borrowerSavingsPaise: borrowerSavings,
      borrowerAppliedPaise: borrowerApplied,
      remainingPaise: remaining,
      guarantors: guarantorsWithProposal,
    });
  }

  return { proposals };
}

export async function confirmSettlement(data: {
  memberId: string;
  settlements: Array<{
    loanId: string;
    borrowerAppliedPaise: number;
    guarantorAllocations: Array<{ userId: string; appliedPaise: number }>;
    note?: string;
  }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return { error: "Unauthorized" };

  await prisma.$transaction(async (tx) => {
    for (const s of data.settlements) {
      const outstanding = await getLoanOutstanding(s.loanId);
      const totalGuarantorDeductions = s.guarantorAllocations.reduce(
        (sum, g) => sum + g.appliedPaise,
        0,
      );
      const totalApplied = s.borrowerAppliedPaise + totalGuarantorDeductions;

      // Validation: total applied must equal outstanding
      if (Math.abs(totalApplied - outstanding) > 1) {
        throw new Error(`Settlement amounts don't match outstanding for loan ${s.loanId}`);
      }

      const settlement = await tx.settlement.create({
        data: {
          loanId: s.loanId,
          triggeredByUserId: session!.user.id,
          outstandingAtTriggerPaise: outstanding,
          borrowerAppliedPaise: s.borrowerAppliedPaise,
          guarantorTotalPaise: totalGuarantorDeductions,
          note: s.note,
          confirmedBy: session!.user.id,
        },
      });

      await tx.settlementGuarantorApplication.createMany({
        data: s.guarantorAllocations.map((g) => ({
          settlementId: settlement.id,
          userId: g.userId,
          appliedPaise: g.appliedPaise,
        })),
      });

      await tx.loan.update({
        where: { id: s.loanId },
        data: { status: "CLOSED_VIA_SETTLEMENT", closedAt: new Date() },
      });

      await tx.event.create({
        data: {
          actorId: session!.user.id,
          kind: "SETTLEMENT_APPLIED",
          entityType: "Settlement",
          entityId: settlement.id,
          payloadJson: { memberId: data.memberId, borrowerAppliedPaise: s.borrowerAppliedPaise, guarantorAllocations: s.guarantorAllocations },
        },
      });
    }

    // Deactivate the member
    await tx.user.update({
      where: { id: data.memberId },
      data: { active: false, deactivatedAt: new Date() },
    });
  });

  revalidatePath("/admin/members");
  revalidatePath("/admin/loans");
  return { success: true };
}
