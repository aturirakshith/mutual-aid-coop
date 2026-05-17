"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getGroupLedger(groupId: string, limit = 50) {
  // Returns the events log as the ledger source of truth
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { entityType: "Contribution", actor: { groupId } },
        { entityType: "Loan", actor: { groupId } },
        { entityType: "Emi", actor: { groupId } },
        { entityType: "Settlement", actor: { groupId } },
      ],
    },
    include: { actor: { select: { name: true, mobile: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return events;
}

export async function getMemberLedger(userId: string, limit = 50) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // Members can only see their own, admins can see any
  if (session.user.role !== "ADMIN" && session.user.id !== userId) {
    throw new Error("Unauthorized");
  }

  const contributions = await prisma.contribution.findMany({
    where: { userId },
    include: { period: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const loans = await prisma.loan.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
  });

  const emis = await prisma.emi.findMany({
    where: { loan: { userId }, status: "PAID" },
    include: { loan: true },
    orderBy: { paidAt: "desc" },
    take: limit,
  });

  const settlements = await prisma.settlementGuarantorApplication.findMany({
    where: { userId },
    include: { settlement: { include: { loan: { include: { user: true } } } } },
  });

  return { contributions, loans, emis, settlements };
}

export async function getGroup(groupId: string) {
  return prisma.group.findUnique({ where: { id: groupId } });
}

export async function ensureGroup() {
  const group = await prisma.group.findFirst();
  return group;
}
