import { ProfitDistributionService } from "./src/services/ProfitDistributionService";
import { prisma } from "./src/lib/prisma";

async function triggerDistribution() {
  console.log("🚀 Manually triggering daily return distribution...");
  try {
    // Delete today's log if it exists to allow re-run
    const today = new Date().toISOString().split('T')[0];
    await prisma.dailyProfitLog.deleteMany({ where: { date: today } });
    
    await ProfitDistributionService.distributeDailyReturns();
    console.log("✅ Distribution complete!");
  } catch (err) {
    console.error("❌ Distribution failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

triggerDistribution();
