import { prisma } from "../src/lib/prisma";

async function checkDuplicates() {
  console.log("--- Checking Investments ---");
  const investments = await prisma.investment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(JSON.stringify(investments, null, 2));

  console.log("\n--- Checking Transactions ---");
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(JSON.stringify(transactions, null, 2));

  console.log("\n--- Checking Staff Commissions ---");
  const commissions = await prisma.staffCommission.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(JSON.stringify(commissions, null, 2));
}

checkDuplicates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
