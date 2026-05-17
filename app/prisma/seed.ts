import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create the group
  const group = await prisma.group.upsert({
    where: { id: "seed-group" },
    update: {},
    create: {
      id: "seed-group",
      name: "Premier MACS 042",
      monthlyContributionPaise: 100000, // ₹1,000
      defaultInterestRateBps: 100, // 1% per month
      lateFeePassse: 10000, // ₹100
      defaultTenureMonths: 12,
      emiDayOfMonth: 15,
      minGuarantorsPerLoan: 1,
    },
  });

  // Create admin user
  const adminHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { groupId_mobile: { groupId: group.id, mobile: "9999999999" } },
    update: {},
    create: {
      groupId: group.id,
      name: "Admin User",
      mobile: "9999999999",
      passwordHash: adminHash,
      role: "ADMIN",
      mustChangePassword: false,
    },
  });

  // Create some member users
  const memberHash = await bcrypt.hash("member123", 10);
  const members = [
    { name: "Arjun Srinivasan", mobile: "9876543210" },
    { name: "Priya Lakshmi", mobile: "9876543211" },
    { name: "Rajesh Kumar", mobile: "9876543212" },
    { name: "Sunita Sharma", mobile: "9876543213" },
    { name: "Vikram Nair", mobile: "9876543214" },
  ];

  for (const m of members) {
    await prisma.user.upsert({
      where: { groupId_mobile: { groupId: group.id, mobile: m.mobile } },
      update: {},
      create: {
        groupId: group.id,
        name: m.name,
        mobile: m.mobile,
        passwordHash: memberHash,
        role: "MEMBER",
        mustChangePassword: false,
      },
    });
  }

  console.log("✅ Seeded:");
  console.log(`   Admin: mobile=9999999999 password=admin123`);
  console.log(`   Members: mobile=9876543210–9876543214 password=member123`);
  console.log(`   Group: ${group.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
