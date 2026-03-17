import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { WithdrawalService } from "../services/WithdrawalService";
import { prisma } from "../lib/prisma";
import { CreateWithdrawalRequestSchema } from "../validations/schemas";
import { getPaginationOptions, formatPaginationResponse } from "../lib/pagination";
import { InvoiceService } from "../services/InvoiceService";

export class WithdrawalController {
  static async request(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const validatedData = CreateWithdrawalRequestSchema.parse(req.body);
      const request = await WithdrawalService.requestWithdrawal(
        userId, 
        validatedData.amount, 
        validatedData.source
      );
      res.status(201).json(request);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: error.errors });
      }
      res.status(400).json({ error: error.message });
    }
  }

  static async list(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const withdrawals = await prisma.withdrawalRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      res.json(withdrawals);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async adminList(req: AuthRequest, res: Response) {
    try {
      const { skip, take, page, limit } = getPaginationOptions(req);
      const search = (req.query.search as string) || "";
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = (req.query.sortOrder as string) || "desc";

      const where: any = {};
      if (search) {
        where.OR = [
          { user: { name: { contains: search } } },
          { user: { email: { contains: search } } },
          { id: { contains: search } }
        ];
      }

      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      const [withdrawals, total] = await Promise.all([
        prisma.withdrawalRequest.findMany({
          skip,
          take,
          where,
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy,
        }),
        prisma.withdrawalRequest.count({ where })
      ]);
      res.json(formatPaginationResponse(withdrawals, total, page, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async staffList(req: AuthRequest, res: Response) {
    const staffId = req.user?.id;
    if (!staffId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const { skip, take, page, limit } = getPaginationOptions(req);
      const [withdrawals, total] = await Promise.all([
        prisma.withdrawalRequest.findMany({
          skip,
          take,
          where: {
            user: { staffId }
          },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.withdrawalRequest.count({ where: { user: { staffId } } })
      ]);
      res.json(formatPaginationResponse(withdrawals, total, page, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async approve(req: AuthRequest, res: Response) {
    const { requestId } = req.body;
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const updated = await WithdrawalService.approveWithdrawal(requestId, adminId);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async reject(req: AuthRequest, res: Response) {
    const { requestId } = req.body;
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const updated = await WithdrawalService.rejectWithdrawal(requestId, adminId);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getInvoice(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const withdrawal = await prisma.withdrawalRequest.findUnique({
        where: { id },
        select: { userId: true, status: true }
      });

      if (!withdrawal) return res.status(404).json({ error: "Voucher not found" });
      
      if (req.user!.role === "CUSTOMER" && withdrawal.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const html = await InvoiceService.generateWithdrawalInvoiceHtml(id);
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
