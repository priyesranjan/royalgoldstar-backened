import { prisma } from "../lib/prisma";

export class WalletService {
  /**
   * Get or create a wallet for a user
   */
  static async getOrCreateWallet(userId: string, tx?: any) {
    const client = tx || prisma;
    let wallet = await client.wallet.findUnique({ where: { userId } });
    
    if (!wallet) {
      wallet = await client.wallet.create({
        data: { userId }
      });
    }
    
    return wallet;
  }

  /**
   * Update wallet balances and recalculate totalWithdrawable
   */
  static async updateBalance(userId: string, data: {
    goldAdvanceAmount?: number;
    profitAmount?: number;
    referralAmount?: number;
    referralBalance?: number;
    staffCommissionBalance?: number;
  }, tx?: any) {
    const client = tx || prisma;
    
    // Ensure wallet exists
    await this.getOrCreateWallet(userId, client);

    // Perform update with increment and then recalculate total
    const updated = await client.wallet.update({
      where: { userId },
      data: {
        goldAdvanceAmount: data.goldAdvanceAmount ? { increment: data.goldAdvanceAmount } : undefined,
        profitAmount: data.profitAmount ? { increment: data.profitAmount } : undefined,
        referralAmount: data.referralAmount ? { increment: data.referralAmount } : undefined,
        referralBalance: data.referralBalance ? { increment: data.referralBalance } : undefined,
        staffCommissionBalance: data.staffCommissionBalance ? { increment: data.staffCommissionBalance } : undefined,
      }
    });

    // Sync totalWithdrawable: goldAdvanceAmount + profitAmount + referralAmount + referralBalance + staffCommissionBalance
    const total = Number(updated.goldAdvanceAmount) + 
                  Number(updated.profitAmount) + 
                  Number(updated.referralAmount) + 
                  Number(updated.referralBalance) + 
                  Number(updated.staffCommissionBalance);
    
    return await client.wallet.update({
      where: { userId },
      data: { totalWithdrawable: total }
    });
  }
}
