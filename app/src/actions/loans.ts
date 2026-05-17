"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateEmiSchedule, computeFirstEmiDate, computeLoanTerms } from "@/lib/emi";
import { isLoanEligible } from "@/actions/contributions";
import { z } from "zod";

const loanRequestSchema = z.object({
  amountPaise: z.number().int().positive(),
  tenureMonths: z.number().int().min(1).max(120),
  reason: z.string().min(10),
  guarantorIds: z.array(z.string()).min(1),
});

export async function submitLoanRequest(data: {
  amountPaise: number;
  tenureMonths: number;
  reason: string;
  guarantorIds: string[];
}) {
  const session = await auth();
  if (!session) return { error: "Not authenticated" };

  const parsed = loanRequestSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const eligible = await isLoanEligible(session.user.id);
  if (!eligible) {
    return { error: "You have unpaid contributions. Settle them before requesting a loan." };
  }

  const group = await prisma.group.findUnique({ where: { id: session.user.groupId } });
  if (!group) return { error: "Group not found" };

  if (parsed.data.guarantorIds.length < group.minGuarantorsPerLoan) {
    return { error: `Minimum ${group.minGuarantorsPerLoan} guarantor(s) required` };
  }

  const loan = await prisma.loan.create({
    data: {
      userId: session.user.id,
      requestedAmountPaise: parsed.data.amountPaise,
      requestedTenure: parsed.data.tenureMonths,
      reason: parsed.data.reason,
      status: "PENDING",
      guarantors: {
        create: parsed.data.guarantorIds.map((id) => ({ userId: id })),
      },
    },
  });

  await prisma.event.create({
    data: {
      actorId: session.user.id,
      kind: "LOAN_REQUESTED",
      entityType: "Loan",
      entityId: loan.id,
      payloadJson: { ...parsed.data },
    },
  });

  revalidatePath("/loans");
  revalidatePath("/admin/loans");
  return { success: true, loanId: loan.id };
}

export async function approveLoan(data: {
  loanId: string;
  principalPaise: number;
  interestRateBps: number;
  tenureMonths: number;
  firstEmiDate: Date;
  guarantorIds: string[];
  ineligibilityWaiverNote?: string;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return { error: "Unauthorized" };

  const loan = await prisma.loan.findUnique({ where: { id: data.loanId } });
  if (!loan || loan.status !== "PENDING") return { error: "Loan not in Pending state" };

  const { interestPaise, disbursalPaise } = computeLoanTerms(
    data.principalPaise,
    data.interestRateBps,
    data.tenureMonths,
  );

  // Replace guarantors with admin-confirmed list
  await prisma.loanGuarantor.deleteMany({ where: { loanId: data.loanId } });
  await prisma.loanGuarantor.createMany({
    data: data.guarantorIds.map((id) => ({ loanId: data.loanId, userId: id })),
  });

  await prisma.loan.update({
    where: { id: data.loanId },
    data: {
      status: "APPROVED",
      principalPaise: data.principalPaise,
      interestRateBps: data.interestRateBps,
      tenureMonths: data.tenureMonths,
      interestPaise,
      disbursalPaise,
      firstEmiDate: data.firstEmiDate,
      approvedAt: new Date(),
      approvedById: session.user.id,
      ineligibilityWaiverNote: data.ineligibilityWaiverNote,
    },
  });

  await prisma.event.create({
    data: {
      actorId: session.user.id,
      kind: "LOAN_APPROVED",
      entityType: "Loan",
      entityId: data.loanId,
      payloadJson: { ...data },
    },
  });

  revalidatePath("/admin/loans");
  return { success: true };
}

export async function rejectLoan(loanId: string, reason: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return { error: "Unauthorized" };

  await prisma.loan.update({
    where: { id: loanId },
    data: { status: "REJECTED" },
  });

  await prisma.event.create({
    data: {
      actorId: session.user.id,
      kind: "LOAN_REJECTED",
      entityType: "Loan",
      entityId: loanId,
      payloadJson: { reason },
    },
  });

  revalidatePath("/admin/loans");
  return { success: true };
}

export async function disburseLoan(loanId: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return { error: "Unauthorized" };

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan || loan.status !== "APPROVED") return { error: "Loan must be in Approved state" };
  if (!loan.principalPaise || !loan.tenureMonths || !loan.firstEmiDate) {
    return { error: "Loan terms incomplete" };
  }

  const schedule = generateEmiSchedule(loan.principalPaise, loan.tenureMonths, loan.firstEmiDate);

  await prisma.$transaction([
    prisma.loan.update({
      where: { id: loanId },
      data: { status: "DISBURSED", disbursedAt: new Date() },
    }),
    prisma.emi.createMany({
      data: schedule.map((e) => ({
        loanId,
        seq: e.seq,
        dueDate: e.dueDate,
        amountPaise: e.amountPaise,
        status: "PENDING",
      })),
    }),
    prisma.event.create({
      data: {
        actorId: session.user.id,
        kind: "LOAN_DISBURSED",
        entityType: "Loan",
        entityId: loanId,
        payloadJson: { loanId, disbursalPaise: loan.disbursalPaise },
      },
    }),
  ]);

  revalidatePath("/admin/loans");
  return { success: true };
}

export async function markEmiPaid(emiId: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return { error: "Unauthorized" };

  const emi = await prisma.emi.findUnique({ where: { id: emiId }, include: { loan: true } });
  if (!emi || emi.status === "PAID") return { error: "EMI already paid or not found" };

  await prisma.emi.update({
    where: { id: emiId },
    data: { status: "PAID", paidAt: new Date(), recordedById: session.user.id },
  });

  // Check if all EMIs paid → close loan
  const pendingEmis = await prisma.emi.count({
    where: { loanId: emi.loanId, status: "PENDING" },
  });

  if (pendingEmis === 0) {
    await prisma.loan.update({
      where: { id: emi.loanId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  }

  await prisma.event.create({
    data: {
      actorId: session.user.id,
      kind: "EMI_PAID",
      entityType: "Emi",
      entityId: emiId,
      payloadJson: { emiId, loanId: emi.loanId },
    },
  });

  revalidatePath("/admin/loans");
  return { success: true };
}

export async function getLoanOutstanding(loanId: string): Promise<number> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { emis: { where: { status: "PAID" } } },
  });

  if (!loan || !loan.principalPaise) return 0;
  if (loan.status === "CLOSED" || loan.status === "CLOSED_VIA_SETTLEMENT") return 0;

  const paidAmount = loan.emis.reduce((sum, e) => sum + e.amountPaise, 0);
  return loan.principalPaise - paidAmount;
}

export async function getPoolBalance(groupId: string): Promise<number> {
  // pool = Σ contributions_paid + Σ EMI_repayments + Σ late_fees - Σ disbursal_amounts
  const contributionSum = await prisma.contribution.aggregate({
    where: { user: { groupId }, status: "PAID" },
    _sum: { amountPaise: true },
  });

  const emiSum = await prisma.emi.aggregate({
    where: { loan: { user: { groupId } }, status: "PAID" },
    _sum: { amountPaise: true },
  });

  const lateFeeSum = await prisma.contribution.aggregate({
    where: { user: { groupId }, status: "PAID" },
    _sum: { lateFeePaise: true },
  });

  const disbursalSum = await prisma.loan.aggregate({
    where: { user: { groupId }, status: { in: ["DISBURSED", "CLOSED", "CLOSED_VIA_SETTLEMENT"] } },
    _sum: { disbursalPaise: true },
  });

  return (
    (contributionSum._sum.amountPaise ?? 0) +
    (emiSum._sum.amountPaise ?? 0) +
    (lateFeeSum._sum.lateFeePaise ?? 0) -
    (disbursalSum._sum.disbursalPaise ?? 0)
  );
}

export async function getPendingLoans(groupId: string) {
  return prisma.loan.findMany({
    where: { user: { groupId }, status: "PENDING" },
    include: {
      user: { select: { id: true, name: true, mobile: true } },
      guarantors: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { requestedAt: "asc" },
  });
}

export async function getLoanById(loanId: string) {
  return prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      user: { select: { id: true, name: true, mobile: true, groupId: true } },
      guarantors: { include: { user: { select: { id: true, name: true, mobile: true } } } },
      emis: { orderBy: { seq: "asc" } },
      approvedBy: { select: { name: true } },
    },
  });
}
