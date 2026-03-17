import { Router } from "express";
import { AdminController } from "../controllers/AdminController";
import { requireAuth, requireRole } from "../middleware/auth";
import { Role } from "@prisma/client";

export const adminRouter = Router();

adminRouter.get("/staff/list", requireAuth, requireRole(Role.ADMIN), AdminController.listAllStaff);
adminRouter.get("/users", requireAuth, requireRole(Role.ADMIN), AdminController.getUsers);
adminRouter.post("/reassign-staff", requireAuth, requireRole(Role.ADMIN), AdminController.reassignStaff);
adminRouter.get("/transactions", requireAuth, requireRole(Role.ADMIN), AdminController.getAllTransactions);
adminRouter.get("/transactions/:userId", requireAuth, requireRole(Role.ADMIN), AdminController.getUserTransactions);
adminRouter.get("/stats", requireAuth, requireRole(Role.ADMIN), AdminController.getDashboardStats);
adminRouter.patch("/users/:userId", requireAuth, requireRole(Role.ADMIN), AdminController.updateUser);
