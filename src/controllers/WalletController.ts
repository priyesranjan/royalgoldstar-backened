import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { WalletService } from "../services/WalletService";
import { prisma } from "../lib/prisma";

export class WalletController {
  /**
   * Get current user's wallet
   */
  static async getMyWallet(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const wallet = await WalletService.getOrCreateWallet(userId);
      res.json(wallet);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all wallets (Admin only)
   */
  static async getAllWallets(req: AuthRequest, res: Response) {
    try {
      const wallets = await prisma.wallet.findMany({
        include: { user: { select: { id: true, name: true, email: true } } }
      });
      res.json(wallets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
