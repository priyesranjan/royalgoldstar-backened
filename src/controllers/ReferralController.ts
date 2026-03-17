import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getPaginationOptions, formatPaginationResponse } from "../lib/pagination";

export class ReferralController {
  static async list(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const { skip, take, page, limit } = getPaginationOptions(req);
      const [referrals, total] = await Promise.all([
        prisma.user.findMany({
          skip,
          take,
          where: { referredBy: userId },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.user.count({ where: { referredBy: userId } })
      ]);
      res.json(formatPaginationResponse(referrals, total, page, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
