"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Session } from "next-auth";

function requireAdmin(session: Session | null) {
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");
  return session;
}

const addMemberSchema = z.object({
  name: z.string().min(2),
  mobile: z.string().length(10).regex(/^\d{10}$/),
  password: z.string().min(6),
  role: z.enum(["MEMBER", "ADMIN"]).default("MEMBER"),
});

export async function addMember(formData: FormData) {
  const session = await auth();
  requireAdmin(session);

  const parsed = addMemberSchema.safeParse({
    name: formData.get("name"),
    mobile: formData.get("mobile"),
    password: formData.get("password"),
    role: formData.get("role") ?? "MEMBER",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation error" };
  }

  const { name, mobile, password, role } = parsed.data;
  const groupId = session!.user.groupId;

  const exists = await prisma.user.findUnique({ where: { groupId_mobile: { groupId, mobile } } });
  if (exists) return { error: "Mobile number already registered" };

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { groupId, name, mobile, passwordHash, role, mustChangePassword: true },
  });

  await prisma.event.create({
    data: {
      actorId: session!.user.id,
      kind: "MEMBER_ADDED",
      entityType: "User",
      entityId: user.id,
      payloadJson: { name, mobile, role },
    },
  });

  revalidatePath("/admin/members");
  return { success: true, userId: user.id };
}

export async function deactivateMember(memberId: string, settlementData?: unknown) {
  const session = await auth();
  requireAdmin(session);

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    include: {
      loans: { where: { status: "DISBURSED" } },
      guaranteedLoans: {
        include: { loan: true },
        where: { loan: { status: "DISBURSED" } },
      },
    },
  });

  if (!member) return { error: "Member not found" };
  if (!member.active) return { error: "Already deactivated" };

  // Block if guaranteeing active loans (FR-2.3)
  if (member.guaranteedLoans.length > 0) {
    return {
      error: "Cannot deactivate: member is guaranteeing active loans. Wait until those loans close.",
      blocked: true,
    };
  }

  // If has active loans as borrower, must run settlement first
  if (member.loans.length > 0 && !settlementData) {
    return {
      needsSettlement: true,
      activeLoans: member.loans,
    };
  }

  await prisma.user.update({
    where: { id: memberId },
    data: { active: false, deactivatedAt: new Date() },
  });

  await prisma.event.create({
    data: {
      actorId: session!.user.id,
      kind: "MEMBER_DEACTIVATED",
      entityType: "User",
      entityId: memberId,
      payloadJson: { memberId },
    },
  });

  revalidatePath("/admin/members");
  return { success: true };
}

export async function resetPassword(memberId: string, newPassword: string): Promise<{ success?: true; error?: string }> {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return { error: "Unauthorized" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: memberId },
    data: { passwordHash, mustChangePassword: true },
  });

  await prisma.event.create({
    data: {
      actorId: session!.user.id,
      kind: "PASSWORD_RESET",
      entityType: "User",
      entityId: memberId,
      payloadJson: { memberId },
    },
  });

  return { success: true };
}

export async function changeOwnPassword(oldPassword: string, newPassword: string) {
  const session = await auth();
  if (!session) return { error: "Not authenticated" };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "User not found" };

  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect" };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return { success: true };
}

export async function getMembers() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  return prisma.user.findMany({
    where: { groupId: session.user.groupId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      mobile: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });
}

export async function getMemberDetail(memberId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  return prisma.user.findUnique({
    where: { id: memberId, groupId: session.user.groupId },
    include: {
      loans: {
        where: { status: { in: ["DISBURSED", "APPROVED"] } },
        include: { guarantors: true, emis: true },
      },
      guaranteedLoans: {
        include: {
          loan: {
            include: { user: true, emis: true, guarantors: true },
          },
        },
        where: { loan: { status: "DISBURSED" } },
      },
    },
  });
}
