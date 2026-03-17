import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");
  
  // ── Clear Database ──────────────────────────────────────────────────────────
  console.log("🧹 Clearing existing data...");
  await (prisma as any).auditLog.deleteMany({});
  await (prisma as any).transaction.deleteMany({});
  await (prisma as any).withdrawalRequest.deleteMany({});
  await (prisma as any).goldAdvance.deleteMany({});
  await (prisma as any).wallet.deleteMany({});
  await (prisma as any).dailyProfitLog.deleteMany({});
  await (prisma as any).staffCommission.deleteMany({});
  await (prisma as any).user.deleteMany({});
  await (prisma as any).systemSetting.deleteMany({});

  const passwordHash = await bcrypt.hash("password123", 10);

  // ── Admin ─────────────────────────────────────────────────────────────────────
  const admin = await (prisma.user as any).upsert({
    where: { email: "admin@rgt.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "admin@rgt.com",
      password: passwordHash,
      role: Role.ADMIN,
      contactNo: "0000000001",
      wallet: { create: {} }
    },
  });
  console.log(`✅ Admin: ${admin.name} (${admin.email})`);


  // ── Staff ─────────────────────────────────────────────────────────────────────
  const staff = await (prisma.user as any).upsert({
    where: { email: "staff@rgt.com" },
    update: {},
    create: {
      name: "Staff Member",
      email: "staff@rgt.com",
      password: passwordHash,
      role: Role.STAFF,
      contactNo: "0000000002",
      wallet: { create: {} }
    },
  });
  console.log(`✅ Staff: ${staff.name} (${staff.email})`);


  // ── Customer ──────────────────────────────────────────────────────────────────
  const customer = await (prisma.user as any).upsert({
    where: { email: "customer@rgt.com" },
    update: {},
    create: {
      name: "John Doe",
      email: "customer@rgt.com",
      password: passwordHash,
      role: Role.CUSTOMER,
      contactNo: "9876543210",
      mobile: "9876543210",
      staffId: staff.id,
      initialGoldAdvanceAmount: 100000,
      wallet: { 
        create: {
          goldAdvanceAmount: 100000,
          totalWithdrawable: 100000
        } 
      }
    },
  });
  console.log(`✅ Customer: ${customer.name} (${customer.email})`);

  // ── Sample Gold Advance ───────────────────────────────────────────────────────
  const existingAdvance = await prisma.goldAdvance.findFirst({
    where: { userId: customer.id }
  });

  if (!existingAdvance) {
    await (prisma.goldAdvance as any).create({
      data: {
        userId: customer.id,
        advanceAmount: 100000,
        status: "ACTIVE"
      }
    });

    await (prisma.transaction as any).create({
      data: {
        userId: customer.id,
        type: "DEPOSIT",
        amount: 100000,
        balanceAfter: 100000,
        description: "Initial Gold Advance Deposit"
      }
    });
  }

  // ── System Setting ───────────────────────────────────────────────────────────
  await (prisma as any).systemSetting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      showGST: true,
      gstPercentage: 18.0
    }
  });
  console.log("✅ System settings initialized.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
