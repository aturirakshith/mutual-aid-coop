import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();

  const name = form.get("name") as string;
  const monthlyContributionPaise = Math.round(parseFloat(form.get("monthlyContribution") as string) * 100);
  const defaultInterestRateBps = Math.round(parseFloat(form.get("interestRate") as string) * 100);
  const lateFeePassse = Math.round(parseFloat(form.get("lateFee") as string) * 100);
  const defaultTenureMonths = parseInt(form.get("defaultTenure") as string);
  const emiDayOfMonth = parseInt(form.get("emiDay") as string);
  const minGuarantorsPerLoan = parseInt(form.get("minGuarantors") as string);

  if (emiDayOfMonth < 1 || emiDayOfMonth > 28) {
    return NextResponse.json({ error: "EMI day must be between 1 and 28" }, { status: 400 });
  }

  // Check if group already exists
  const existing = await prisma.group.findFirst();
  if (existing) {
    return NextResponse.json({ error: "Group already configured" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        name,
        monthlyContributionPaise,
        defaultInterestRateBps,
        lateFeePassse,
        defaultTenureMonths,
        emiDayOfMonth,
        minGuarantorsPerLoan,
      },
    });

    // Link the admin user to this group
    await tx.user.update({
      where: { id: session.user.id },
      data: { groupId: group.id },
    });
  });

  return NextResponse.json({ success: true });
}
