import { Router } from "express";
import { StaffController } from "../controllers/StaffController";
import { requireAuth, requireRole } from "../middleware/auth";
import { Role } from "@prisma/client";

export const staffRouter = Router();

staffRouter.get("/stats", requireAuth, requireRole(Role.STAFF), StaffController.getDashboardStats);
staffRouter.get("/customers", requireAuth, requireRole(Role.STAFF), StaffController.getCustomers);
staffRouter.get("/earnings", requireAuth, requireRole(Role.STAFF), StaffController.getEarnings);
staffRouter.get("/transactions", requireAuth, requireRole(Role.STAFF), StaffController.getCustomerTransactions);
staffRouter.get("/transactions/:userId", requireAuth, requireRole(Role.STAFF), StaffController.getSpecificCustomerTransactions);
staffRouter.patch("/customers/:userId", requireAuth, requireRole(Role.STAFF), StaffController.updateCustomer);
