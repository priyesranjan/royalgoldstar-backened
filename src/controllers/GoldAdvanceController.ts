import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { GoldAdvanceService } from "../services/GoldAdvanceService";
import { prisma } from "../lib/prisma";
import { CreateGoldAdvanceSchema, CreateManualGoldAdvanceSchema } from "../validations/schemas";
import { InvoiceService } from "../services/InvoiceService";
import { getPaginationOptions, formatPaginationResponse } from "../lib/pagination";

export class GoldAdvanceController {
  static async getInvoice(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const advance = await prisma.goldAdvance.findUnique({
        where: { id },
        select: { userId: true }
      });

      if (!advance) return res.status(404).json({ error: "Invoice not found" });
      
      if (req.user!.role === "CUSTOMER" && advance.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const html = await InvoiceService.generateInvoiceHtml(id);
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const validatedData = CreateGoldAdvanceSchema.parse(req.body);
      const goldAdvance = await GoldAdvanceService.createGoldAdvance(userId, validatedData.amount);
      res.status(201).json(goldAdvance);
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
      const goldAdvances = await GoldAdvanceService.getUserGoldAdvances(userId);
      res.json(goldAdvances);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async adminList(req: AuthRequest, res: Response) {
    try {
      const { skip, take, page, limit } = getPaginationOptions(req);
      const [goldAdvances, total] = await Promise.all([
        prisma.goldAdvance.findMany({
          skip,
          take,
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.goldAdvance.count()
      ]);
      res.json(formatPaginationResponse(goldAdvances, total, page, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async manualCreate(req: AuthRequest, res: Response) {
    try {
      const validatedData = CreateManualGoldAdvanceSchema.parse(req.body);
      const goldAdvance = await GoldAdvanceService.createManualGoldAdvance(
        validatedData.userId,
        validatedData.amount,
        req.user!.id,
        validatedData.description
      );
      res.status(201).json(goldAdvance);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: error.errors });
      }
      res.status(400).json({ error: error.message });
    }
  }
}
