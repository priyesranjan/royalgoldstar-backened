import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { Role } from "@prisma/client";
import { getPaginationOptions, formatPaginationResponse } from "../lib/pagination";

export class AuditController {
  /**
   * Get all audit logs (Admin only)
   */
  static async getLogs(req: AuthRequest, res: Response) {
    if (req.user?.role !== Role.ADMIN) {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    const { actionType, entityType, entityId, performedByUserId, startDate, endDate } = req.query;

    try {
      const { skip, take, page, limit } = getPaginationOptions(req);
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          skip,
          take,
          where: {
            actionType: actionType ? (actionType as any) : undefined,
            entityType: entityType ? (entityType as string) : undefined,
            entityId: entityId ? (entityId as string) : undefined,
            performedByUserId: performedByUserId ? (performedByUserId as string) : undefined,
            createdAt: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.auditLog.count({
          where: {
            actionType: actionType ? (actionType as any) : undefined,
            entityType: entityType ? (entityType as string) : undefined,
            entityId: entityId ? (entityId as string) : undefined,
            performedByUserId: performedByUserId ? (performedByUserId as string) : undefined,
            createdAt: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
          },
        })
      ]);

      res.json(formatPaginationResponse(logs, total, page, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get logs for a specific entity
   */
  static async getEntityLogs(req: AuthRequest, res: Response) {
    const { entityType, entityId } = req.params;

    // Admin or Staff can view (Staff might need restrictions, but for now allow)
    if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.STAFF) {
      return res.status(403).json({ error: "Access denied." });
    }

    try {
      const { skip, take, page, limit } = getPaginationOptions(req);
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          skip,
          take,
          where: { entityType, entityId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.auditLog.count({ where: { entityType, entityId } })
      ]);

      res.json(formatPaginationResponse(logs, total, page, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
