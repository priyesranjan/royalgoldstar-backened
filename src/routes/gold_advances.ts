import { Router } from "express";
import { GoldAdvanceController } from "../controllers/GoldAdvanceController";
import { requireAuth, requireRole } from "../middleware/auth";
import { Role } from "@prisma/client";

export const goldAdvanceRouter = Router();

// Customer Endpoints
goldAdvanceRouter.post("/", requireAuth, requireRole(Role.CUSTOMER), GoldAdvanceController.create);
goldAdvanceRouter.get("/", requireAuth, requireRole(Role.CUSTOMER), GoldAdvanceController.list);
goldAdvanceRouter.get("/:id/invoice", requireAuth, GoldAdvanceController.getInvoice);

// Admin & Staff Endpoints
goldAdvanceRouter.get("/admin/all", requireAuth, requireRole(Role.ADMIN), GoldAdvanceController.adminList);
goldAdvanceRouter.post("/admin/create", requireAuth, requireRole(Role.ADMIN, Role.STAFF), GoldAdvanceController.manualCreate);
goldAdvanceRouter.post("/manual", requireAuth, requireRole(Role.ADMIN, Role.STAFF), GoldAdvanceController.manualCreate);
