import { prisma } from "./src/lib/prisma";
import { GoldAdvanceStatus, Role } from "@prisma/client";

async function debugCron() {
  console.log("--- COMPREHENSIVE DEBUG ---");
  
  const totalUsers = await prisma.user.count({ where: { role: Role.CUSTOMER } });
  console.log("Total Customers:", totalUsers);
  
  const totalAdvances = await prisma.goldAdvance.count();
  console.log("Total Gold Advances (all statuses):", totalAdvances);
  
  const statusCounts = await prisma.goldAdvance.groupBy({
    by: ['status'],
    _count: true
  });
  console.log("Advances by Status:", statusCounts);
  
  const walletsWithBalance = await prisma.wallet.findMany({
    where: { goldAdvanceAmount: { gt: 0 } },
    select: { userId: true, goldAdvanceAmount: true }
  });
  console.log("Wallets with Gold Advance Balance:", walletsWithBalance);
  
  const usersWithActiveAdvances = await prisma.user.findMany({
    where: { goldAdvances: { some: { status: GoldAdvanceStatus.ACTIVE } } },
    select: { id: true, name: true }
  });
  console.log("Users with Active Gold Advances:", usersWithActiveAdvances);

  process.exit(0);
}

debugCron();
