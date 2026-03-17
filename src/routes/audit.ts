import { Router } from "express";
import { AuditController } from "../controllers/AuditController";
import { requireAuth } from "../middleware/auth";

export const auditRouter = Router();

// Get all logs (Admin only)
auditRouter.get("/", requireAuth, AuditController.getLogs);

// Get logs for a specific entity
auditRouter.get("/:entityType/:entityId", requireAuth, AuditController.getEntityLogs);
