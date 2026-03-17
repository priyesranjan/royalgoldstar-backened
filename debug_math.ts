import { prisma } from "./src/lib/prisma";
import { GoldAdvanceStatus, TransactionType } from "@prisma/client";

async function debugMath() {
  console.log("--- PROFIT CALCULATION DEBUG ---");
  
  const activeAdvances = await prisma.goldAdvance.findMany({
    where: { status: GoldAdvanceStatus.ACTIVE },
    include: {
      user: {
        select: { id: true, name: true, referredBy: true, staffId: true }
      }
    }
  });
  
  console.log(`Found ${activeAdvances.length} active advances.`);
  
  for (const adv of activeAdvances) {
    const amt = Number(adv.advanceAmount);
    const dailyProfit = Number(((amt * 0.05) / 30).toFixed(2));
    console.log(`User: ${adv.user.name}, Advance: ${amt}, Daily Profit: ${dailyProfit}`);
    
    // Check if this advance ever got a profit transaction
    const profitTx = await prisma.transaction.findFirst({
      where: {
        userId: adv.userId,
        type: TransactionType.PROFIT,
        description: { contains: adv.id }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`  Last Profit Tx:`, profitTx ? profitTx.createdAt : "NONE");
  }
  
  const recentLogs = await prisma.dailyProfitLog.findMany({
    take: 5,
    orderBy: { date: 'desc' }
  });
  console.log("Recent Logs:", recentLogs);

  process.exit(0);
}

debugMath();
