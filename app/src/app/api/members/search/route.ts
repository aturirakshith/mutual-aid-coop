import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const members = await prisma.user.findMany({
    where: {
      groupId: session.user.groupId,
      active: true,
      id: { not: session.user.id }, // exclude self
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { mobile: { contains: q } },
      ],
    },
    select: { id: true, name: true, mobile: true },
    take: 10,
  });

  return NextResponse.json({ members });
}
