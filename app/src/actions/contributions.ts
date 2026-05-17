"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getCurrentPeriod(groupId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let period = await prisma.contributionPeriod.findUnique({
    where: { groupId_year_month: { groupId, year, month } },
  });

  if (!period) {
    // Auto-create period (FR-3.1)
    period = await prisma.contributionPeriod.create({ data: { groupId, year, month } });

    // Create contribution rows for all active members
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    const members = await prisma.user.findMany({
      where: { groupId, active: true, role: "MEMBER" },
    });

    await prisma.contribution.createMany({
      data: members.map((m) => ({
        periodId: period!.id,
        userId: m.id,
        status: "UNPAID" as const,
        amountPaise: group!.monthlyContributionPaise,
      })),
      skipDuplicates: true,
    });
  }

  return period;
}

export async function markContributionPaid(contributionId: string, note?: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: { period: true },
  });
  if (!contribution) return { error: "Not found" };
  if (contribution.status === "PAID") return { error: "Already marked paid" };

  await prisma.contribution.update({
    where: { id: contributionId },
    data: { status: "PAID", paidAt: new Date(), note, recordedById: session.user.id },
  });

  await prisma.event.create({
    data: {
      actorId: session.user.id,
      kind: "CONTRIBUTION_PAID",
      entityType: "Contribution",
      entityId: contributionId,
      payloadJson: { contributionId, note },
    },
  });

  revalidatePath("/admin/contributions");
  return { success: true };
}

export async function reverseContribution(contributionId: string, note: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  if (!note.trim()) return { error: "Reversal note is required" };

  const contribution = await prisma.contribution.findUnique({ where: { id: contributionId } });
  if (!contribution || contribution.status !== "PAID") {
    return { error: "Can only reverse a Paid contribution" };
  }

  await prisma.contribution.update({
    where: { id: contributionId },
    data: { status: "REVERSED", note: `REVERSED: ${note}`, recordedById: session.user.id },
  });

  await prisma.event.create({
    data: {
      actorId: session.user.id,
      kind: "CONTRIBUTION_REVERSED",
      entityType: "Contribution",
      entityId: contributionId,
      payloadJson: { contributionId, note },
    },
  });

  revalidatePath("/admin/contributions");
  return { success: true };
}

export async function applyLateFeesForPeriod(periodId: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const period = await prisma.contributionPeriod.findUnique({
    where: { id: periodId },
    include: { group: true },
  });
  if (!period) return { error: "Period not found" };

  const unpaid = await prisma.contribution.findMany({
    where: { periodId, status: "UNPAID", lateFeePaise: 0 },
  });

  for (const c of unpaid) {
    await prisma.contribution.update({
      where: { id: c.id },
      data: { lateFeePaise: period.group.lateFeePassse },
    });
  }

  revalidatePath("/admin/contributions");
  return { success: true, count: unpaid.length };
}

export async function getContributionsForPeriod(groupId: string, year: number, month: number) {
  const period = await prisma.contributionPeriod.findUnique({
    where: { groupId_year_month: { groupId, year, month } },
    include: {
      contributions: {
        include: { user: { select: { id: true, name: true, mobile: true } } },
        orderBy: { user: { name: "asc" } },
      },
    },
  });

  return period;
}

export async function memberSavings(userId: string): Promise<number> {
  // savings = Σ contributions_paid − Σ settlement_applications_against_this_user
  const paidContributions = await prisma.contribution.aggregate({
    where: { userId, status: "PAID" },
    _sum: { amountPaise: true },
  });

  const settlementDeductions = await prisma.settlementGuarantorApplication.aggregate({
    where: { userId },
    _sum: { appliedPaise: true },
  });

  // Also subtract borrower's own settlement applications
  const borrowerSettlements = await prisma.settlement.findMany({
    where: { loan: { userId } },
    select: { borrowerAppliedPaise: true },
  });

  const totalPaid = paidContributions._sum.amountPaise ?? 0;
  const guarantorDeductions = settlementDeductions._sum.appliedPaise ?? 0;
  const borrowerDeductions = borrowerSettlements.reduce((sum, s) => sum + s.borrowerAppliedPaise, 0);

  return totalPaid - guarantorDeductions - borrowerDeductions;
}

export async function isLoanEligible(userId: string): Promise<boolean> {
  const unpaidCount = await prisma.contribution.count({
    where: { userId, status: "UNPAID" },
  });
  return unpaidCount === 0;
}
