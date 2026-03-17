import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getPaginationOptions, formatPaginationResponse } from "../lib/pagination";

import { AuditService } from "../services/AuditService";
import { AuditAction } from "@prisma/client";

export class StaffController {
  static async getDashboardStats(req: AuthRequest, res: Response) {
    const staffId = req.user?.id;
    if (!staffId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const customersCount = await prisma.user.count({ where: { staffId } });
      
      const commissionSums = await prisma.staffCommission.aggregate({
        where: { staffId },
        _sum: { amount: true }
      });

      const wallet = await prisma.wallet.findUnique({
        where: { userId: staffId }
      });

      res.json({
        customersCount,
        totalCommission: Number(commissionSums._sum.amount || 0),
        walletBalance: Number(wallet?.referralAmount || 0)
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getCustomers(req: AuthRequest, res: Response) {
    const staffId = req.user?.id;
    if (!staffId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const { skip, take, page, limit } = getPaginationOptions(req);
      const [customers, total] = await Promise.all([
        prisma.user.findMany({
          skip,
          take,
          where: { staffId },
          select: {
            id: true, name: true, email: true, contactNo: true, mobile: true,
            aadharNo: true, pan: true, address: true, photo: true, gender: true, dob: true,
            createdAt: true,
            wallet: true,
            goldAdvances: {
              where: { status: "ACTIVE" },
              select: { advanceAmount: true }
            }
          }
        }),
        prisma.user.count({ where: { staffId } })
      ]);

      const mappedCustomers = (customers as any[]).map((user: any) => {
        const totalGoldAdvanceAmount = user.goldAdvances?.reduce((sum: number, adv: any) => sum + Number(adv.advanceAmount), 0) || 0;
        
        return {
          ...user,
          wallet: user.wallet ? {
            goldAdvanceAmount: Number(user.wallet.goldAdvanceAmount || 0),
            profitAmount: Number(user.wallet.profitAmount || 0),
            referralAmount: Number(user.wallet.referralAmount || 0),
            totalWithdrawable: Number(user.wallet.totalWithdrawable || 0),
          } : null,
          totalGoldAdvanceAmount
        };
      });

      res.json(formatPaginationResponse(mappedCustomers, total, page, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getEarnings(req: AuthRequest, res: Response) {
    const staffId = req.user?.id;
    if (!staffId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const { skip, take, page, limit } = getPaginationOptions(req);
      const [earnings, total] = await Promise.all([
        prisma.staffCommission.findMany({
          skip,
          take,
          where: { staffId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.staffCommission.count({ where: { staffId } })
      ]);
      res.json(formatPaginationResponse(earnings, total, page, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getCustomerTransactions(req: AuthRequest, res: Response) {
    const staffId = req.user?.id;
    if (!staffId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const { skip, take, page, limit } = getPaginationOptions(req);
      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          skip,
          take,
          where: {
            user: { staffId }
          },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.transaction.count({ where: { user: { staffId } } })
      ]);
      res.json(formatPaginationResponse(transactions, total, page, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getSpecificCustomerTransactions(req: AuthRequest, res: Response) {
    const staffId = req.user?.id;
    const { userId } = req.params;
    if (!staffId) return res.status(401).json({ error: "Unauthorized" });

    try {
      // Verify the user is assigned to this staff
      const user = await prisma.user.findFirst({
        where: { id: userId, staffId }
      });
      if (!user) return res.status(403).json({ error: "Access denied. Customer not assigned to you." });

      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateCustomer(req: AuthRequest, res: Response) {
    const staffId = req.user?.id;
    const { userId } = req.params;
    const { name, email, contactNo, aadharNo, pan, address, photo, gender, dob } = req.body;

    if (!staffId) return res.status(401).json({ error: "Unauthorized" });

    try {
      // 1. Verify existence and ownership
      const existingUser = await prisma.user.findFirst({
        where: { id: userId, staffId, role: "CUSTOMER" }
      });
      if (!existingUser) return res.status(403).json({ error: "Access denied. Customer not assigned to you." });

      // 2. Check contactNo uniqueness
      if (contactNo) {
        const duplicate = await prisma.user.findFirst({
          where: { contactNo, NOT: { id: userId } }
        });
        if (duplicate) return res.status(400).json({ error: "Contact number already in use" });
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { 
          name, 
          email, 
          contactNo: contactNo || null,
          mobile: contactNo || null, // Legacy
          aadharNo: aadharNo || null,
          aadhar: aadharNo || null, // Legacy
          pan: pan ? pan.toUpperCase() : null,
          address: address || null,
          photo: photo || null,
          gender: gender || null,
          dob: dob ? new Date(dob) : null
        }
      });

      // 3. Log Audit Record
      await AuditService.logAction({
        actionType: AuditAction.CUSTOMER_UPDATED,
        entityType: "User",
        entityId: userId,
        performedByUserId: staffId,
        performedByRole: req.user?.role,
        previousData: existingUser,
        newData: user,
        description: `Customer ${userId} updated by Staff ${staffId}`,
        ipAddress: req.ip
      });

      res.json({ message: "Customer updated successfully", user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
