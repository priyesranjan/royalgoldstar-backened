import { prisma } from "./src/lib/prisma";
import { CustomerService } from "./src/services/CustomerService";
import { ProfitDistributionService } from "./src/services/ProfitDistributionService";
import { WithdrawalService } from "./src/services/WithdrawalService";
import { Role, WithdrawalSource } from "@prisma/client";

async function main() {
  console.log("🚀 Starting E2E Verification Flow...");

  // 0. Ensure Staff exists
  console.log("\n0️⃣ Ensuring Staff exists...");
  const staff = await prisma.user.upsert({
    where: { email: "staff_e2e@example.com" },
    update: {},
    create: {
      name: "E2E Staff",
      email: "staff_e2e@example.com",
      password: "password123",
      role: Role.STAFF,
      wallet: { create: {} }
    }
  });
  console.log("✅ Staff Ready:", staff.id);

  const testEmail = `test_${Date.now()}@example.com`;
  
  // 1. Onboarding
  console.log("\n1️⃣ Onboarding Customer...");
  const onboardResult = await CustomerService.onboardCustomer({
    name: "E2E Test User",
    email: testEmail,
    contactNo: String(Date.now()).slice(-10),
    password: "password123",
    initialGoldAdvanceAmount: 10000,
    staffId: staff.id,
    performedByUserId: staff.id,
    performedByRole: Role.ADMIN
  });
  console.log("✅ Customer Onboarded:", onboardResult.user.id);

  // 2. Verify Initial State
  const wallet: any = await prisma.wallet.findUnique({ where: { userId: onboardResult.user.id } });
  console.log("📊 Initial Wallet State:", {
    goldAdvanceAmount: Number(wallet.goldAdvanceAmount),
    totalWithdrawable: Number(wallet.totalWithdrawable),
    profitAmount: Number(wallet.profitAmount)
  });

  // 3. Profit Distribution
  console.log("\n2️⃣ Running Daily Profit Distribution...");
  const distributionResults = await ProfitDistributionService.distributeDailyReturns();
  console.log("✅ Distribution Results:", distributionResults);

  const walletAfterProfit: any = await prisma.wallet.findUnique({ where: { userId: onboardResult.user.id } });
  console.log("📊 Wallet After Profit:", {
    profitAmount: Number(walletAfterProfit.profitAmount),
    totalWithdrawable: Number(walletAfterProfit.totalWithdrawable)
  });

  // 4. Withdrawal Request
  console.log("\n3️⃣ Requesting Profit Withdrawal...");
  const withdrawAmount = 5; 
  const withdrawRequest: any = await (WithdrawalService as any).requestWithdrawal(
    onboardResult.user.id,
    withdrawAmount,
    (WithdrawalSource as any).PROFIT
  );
  console.log("✅ Withdrawal Requested:", withdrawRequest.id);

  // 5. Approve Withdrawal
  console.log("\n4️⃣ Approving Withdrawal...");
  const approvedWithdrawal = await (WithdrawalService as any).approveWithdrawal(withdrawRequest.id, "SYSTEM");
  console.log("✅ Withdrawal Approved.");

  const finalWallet: any = await prisma.wallet.findUnique({ where: { userId: onboardResult.user.id } });
  console.log("📊 Final Wallet State:", {
    profitAmount: Number(finalWallet.profitAmount),
    totalWithdrawable: Number(finalWallet.totalWithdrawable)
  });

  // 6. Verify Audit Logs
  console.log("\n5️⃣ Verifying Audit Logs...");
  const auditLogs = await prisma.auditLog.findMany({
    where: { 
      OR: [
        { entityId: onboardResult.user.id },
        { entityId: withdrawRequest.id }
      ]
    },
    orderBy: { createdAt: "asc" }
  });
  console.log(`✅ Found ${auditLogs.length} audit logs:`);
  auditLogs.forEach(log => {
    console.log(` - [${log.actionType}] ${log.description}`);
  });

  console.log("\n🏁 E2E Verification Complete!");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ E2E Verification Failed:", err);
  process.exit(1);
});
