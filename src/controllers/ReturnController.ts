import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { TransactionType } from "@prisma/client";

export class ReturnController {
  /**
   * Get current user's daily return history
   */
  static async getMyReturns(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const returns = await prisma.transaction.findMany({
        where: { 
          userId, 
          type: { in: [TransactionType.PROFIT, TransactionType.DAILY_RETURN] } 
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(returns);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get current user's referral reward history
   */
  static async getMyReferralRewards(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const rewards = await prisma.transaction.findMany({
        where: { 
          userId, 
          type: { in: [TransactionType.REFERRAL, TransactionType.REFERRAL_REWARD] } 
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(rewards);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
