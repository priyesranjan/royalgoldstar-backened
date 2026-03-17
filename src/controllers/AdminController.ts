import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getPaginationOptions, formatPaginationResponse } from "../lib/pagination";

import { AuditService } from "../services/AuditService";
import { AuditAction } from "@prisma/client";

export class AdminController {
  static async listAllStaff(req: AuthRequest, res: Response) {
    try {
      const staff = await prisma.user.findMany({
        where: { role: "STAFF" },
        select: { id: true, name: true, email: true }
      });
      res.json(staff);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getUsers(req: AuthRequest, res: Response) {
    try {
      const { skip, take, page, limit } = getPaginationOptions(req);
      const role = (req.query.role as string) || "CUSTOMER";
      const search = (req.query.search as string) || "";
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = (req.query.sortOrder as string) || "desc";

      const where: any = { role: role as any };
      
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { mobile: { contains: search } },
          { contactNo: { contains: search } },
          { id: { contains: search } }
        ];
      }

      const orderBy: any = {};
      if (sortBy === "goldAdvancesSum") {
        orderBy.wallet = { goldAdvanceAmount: sortOrder };
      } else {
        orderBy[sortBy] = sortOrder;
      }
      
      const [users, total] = await Promise.all([
        (prisma.user as any).findMany({
          skip,
          take,
          where,
          select: {
            id: true, name: true, email: true, contactNo: true, mobile: true,
            aadharNo: true, pan: true, address: true, photo: true, gender: true, dob: true,
            referredBy: true, staffId: true, createdAt: true,
            role: true,
            wallet: true,
            goldAdvances: {
              where: { status: "ACTIVE" },
              select: { advanceAmount: true }
            },
            referrer: { select: { id: true, name: true, email: true } },
            assignedStaff: { select: { id: true, name: true, email: true } },
            customers: { select: { id: true } }
          },
          orderBy,
        }),
        prisma.user.count({ where })
      ]);

      const mappedUsers = await Promise.all((users as any[]).map(async (user: any) => {
        const [goldAdvanceAgg, withdrawalAgg, profitAgg, referralAgg] = await Promise.all([
          prisma.goldAdvance.aggregate({
            where: { userId: user.id },
            _sum: { advanceAmount: true }
          }),
          prisma.withdrawalRequest.aggregate({
            where: { userId: user.id, status: "APPROVED" },
            _sum: { amount: true }
          }),
          prisma.transaction.aggregate({
            where: { userId: user.id, type: "PROFIT" },
            _sum: { amount: true }
          }),
          prisma.transaction.aggregate({
            where: { userId: user.id, type: "REFERRAL" },
            _sum: { amount: true }
          })
        ]);

        return {
          ...user,
          wallet: user.wallet ? {
            goldAdvanceAmount: Number(user.wallet.goldAdvanceAmount || 0),
            profitAmount: Number(user.wallet.profitAmount || 0),
            referralAmount: Number(user.wallet.referralAmount || 0),
            totalWithdrawable: Number(user.wallet.totalWithdrawable || 0),
          } : null,
          totalGoldAdvanceAmount: Number(goldAdvanceAgg._sum.advanceAmount || 0),
          totalLifetimeWithdrawal: Number(withdrawalAgg._sum.amount || 0),
          totalLifetimeProfit: Number(profitAgg._sum.amount || 0),
          totalLifetimeReferralProfit: Number(referralAgg._sum.amount || 0)
        };
      }));

      res.json(formatPaginationResponse(mappedUsers, total, page, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async reassignStaff(req: AuthRequest, res: Response) {
    const { userId, staffId } = req.body;
    try {
      const existingUser = await prisma.user.findUnique({ where: { id: userId } });
      const user = await prisma.user.update({
        where: { id: userId },
        data: { staffId },
        include: { assignedStaff: true }
      });

      // Log Audit
      await AuditService.logAction({
        actionType: AuditAction.STAFF_REASSIGNED,
        entityType: "User",
        entityId: userId,
        previousData: { staffId: existingUser?.staffId },
        newData: { staffId },
        performedByUserId: req.user?.id,
        performedByRole: req.user?.role,
        description: `Customer ${userId} reassigned to Staff ${staffId}`,
        ipAddress: req.ip
      });

      res.json({ message: "Staff reassigned successfully", user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getAllTransactions(req: AuthRequest, res: Response) {
    try {
      const { skip, take, page, limit } = getPaginationOptions(req);
      const search = (req.query.search as string) || "";
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = (req.query.sortOrder as string) || "desc";

      const where: any = {};
      if (search) {
        where.OR = [
          { description: { contains: search } },
          { user: { name: { contains: search } } },
          { user: { email: { contains: search } } },
          { id: { contains: search } }
        ];
      }

      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          skip,
          take,
          where,
          include: { user: { select: { name: true, email: true } } },
          orderBy,
        }),
        prisma.transaction.count({ where })
      ]);
      res.json(formatPaginationResponse(transactions, total, page, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getUserTransactions(req: AuthRequest, res: Response) {
    const { userId } = req.params;
    try {
      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getDashboardStats(req: AuthRequest, res: Response) {
    try {
      const investorsCount = await prisma.user.count({ where: { role: "CUSTOMER" } });
      const staffCount = await prisma.user.count({ where: { role: "STAFF" } });
      const pendingWithdrawalsCount = await prisma.withdrawalRequest.count({ where: { status: "PENDING" } });
      const totalPendingWithdrawalAmount = await (prisma.withdrawalRequest as any).aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true }
      });

      const walletSums: any = await (prisma.wallet as any).aggregate({
        _sum: {
          goldAdvanceAmount: true,
          profitAmount: true,
          referralAmount: true,
          totalWithdrawable: true
        }
      });

      const today = new Date();
      const startOfToday = new Date(today.setHours(0, 0, 0, 0));
      const endOfToday = new Date(today.setHours(23, 59, 59, 999));
      
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const [
        todayGoldAdvanceAgg,
        todayWithdrawalsAgg,
        monthlyGoldAdvanceAgg,
        monthlyWithdrawalsAgg,
        totalApprovedWithdrawals,
        potentialReferrers,
        staffMembers,
        potentialTopCustomers
      ] = await Promise.all([
        prisma.goldAdvance.aggregate({
          where: { createdAt: { gte: startOfToday, lte: endOfToday } },
          _sum: { advanceAmount: true }
        }),
        prisma.withdrawalRequest.aggregate({
          where: { 
            status: "APPROVED",
            updatedAt: { gte: startOfToday, lte: endOfToday }
          },
          _sum: { amount: true }
        }),
        prisma.goldAdvance.aggregate({
          where: { createdAt: { gte: startOfMonth } },
          _sum: { advanceAmount: true }
        }),
        prisma.withdrawalRequest.aggregate({
          where: { 
            status: "APPROVED",
            updatedAt: { gte: startOfMonth }
          },
          _sum: { amount: true }
        }),
        prisma.withdrawalRequest.aggregate({
          where: { status: "APPROVED" },
          _sum: { amount: true }
        }),
        prisma.user.findMany({
          where: { role: "CUSTOMER", referrals: { some: {} } },
          select: {
            id: true, name: true, email: true,
            referrals: {
              select: { wallet: { select: { goldAdvanceAmount: true } } }
            }
          }
        }),
        prisma.user.findMany({
          where: { role: "STAFF" },
          select: {
            id: true, name: true, email: true,
            customers: {
              select: { wallet: { select: { goldAdvanceAmount: true } } }
            }
          }
        }),
        prisma.user.findMany({
          where: { role: "CUSTOMER" },
          select: {
            id: true, name: true, email: true,
            wallet: { select: { goldAdvanceAmount: true } }
          },
          orderBy: { wallet: { goldAdvanceAmount: "desc" } },
          take: 5
        })
      ]);

      const topCustomers = potentialTopCustomers.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        goldAdvance: Number(c.wallet?.goldAdvanceAmount || 0)
      }));

      const topReferrers = potentialReferrers.map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        refereeCount: r.referrals.length,
        totalNetworkAUM: r.referrals.reduce((sum: number, c: any) => sum + Number(c.wallet?.goldAdvanceAmount || 0), 0)
      })).sort((a, b) => b.totalNetworkAUM - a.totalNetworkAUM).slice(0, 5);

      const staffPerformance = staffMembers.map((s: any) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        managedCustomers: s.customers.length,
        managedAUM: s.customers.reduce((sum: number, c: any) => sum + Number(c.wallet?.goldAdvanceAmount || 0), 0)
      })).sort((a, b) => b.managedAUM - a.managedAUM);

      // AUM Trend Calculation (Last 6 Months)
      const aumTrend = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthName = d.toLocaleString('default', { month: 'short' });
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

        const aumAtPoint = await prisma.goldAdvance.aggregate({
          where: { createdAt: { lte: endOfMonth }, status: "ACTIVE" },
          _sum: { advanceAmount: true }
        });

        aumTrend.push({
          name: monthName,
          aum: Number(aumAtPoint._sum.advanceAmount || 0)
        });
      }

      const totalGoldAdvance = Number(walletSums._sum.goldAdvanceAmount || 0);
      const monthlyDeposits = Number(monthlyGoldAdvanceAgg._sum.advanceAmount || 0);
      const monthlyGrowth = totalGoldAdvance > 0 ? (monthlyDeposits / totalGoldAdvance) * 100 : 0;

      res.json({
        totalGoldAdvance,
        totalProfitDistributed: Number(walletSums._sum.profitAmount || 0),
        totalWithdrawals: Number(totalApprovedWithdrawals._sum.amount || 0),
        todayGoldAdvance: Number(todayGoldAdvanceAgg._sum.advanceAmount || 0),
        todayWithdrawals: Number(todayWithdrawalsAgg._sum.amount || 0),
        monthlyNetFlow: monthlyDeposits - Number(monthlyWithdrawalsAgg._sum.amount || 0),
        monthlyGrowth: Number(monthlyGrowth.toFixed(2)),
        investorsCount,
        staffCount,
        pendingWithdrawalsCount,
        totalPendingAmount: Number(totalPendingWithdrawalAmount._sum.amount || 0),
        topReferrers,
        topCustomers,
        staffPerformance,
        aumTrend,
        walletStats: {
          totalReferrals: Number(walletSums._sum.referralAmount || 0),
          totalWithdrawable: Number(walletSums._sum.totalWithdrawable || 0)
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateUser(req: AuthRequest, res: Response) {
    const { userId } = req.params;
    const { name, email, contactNo, aadharNo, pan, role, staffId, referredBy, address, photo, gender, dob } = req.body;

    try {
      const existingUser = await prisma.user.findUnique({ where: { id: userId } });

      // Check for uniqueness
      if (contactNo) {
        const existing: any = await (prisma.user as any).findFirst({
          where: { contactNo, NOT: { id: userId } }
        });
        if (existing) return res.status(400).json({ error: "Contact number already in use" });
      }

      const user: any = await (prisma.user as any).update({
        where: { id: userId },
        data: {
          name, 
          email, 
          contactNo: contactNo || null,
          mobile: contactNo || null, // Legacy
          aadharNo: aadharNo || null,
          aadhar: aadharNo || null, // Legacy
          pan: pan ? pan.toUpperCase() : null,
          role: role as any,
          staffId: staffId === "" ? null : staffId,
          referredBy: referredBy === "" ? null : referredBy,
          address: address || null,
          photo: photo || null,
          gender: gender || null,
          dob: dob ? new Date(dob) : null
        }
      });

      // Log Audit
      await AuditService.logAction({
        actionType: AuditAction.CUSTOMER_UPDATED,
        entityType: "User",
        entityId: userId,
        performedByUserId: req.user?.id,
        performedByRole: req.user?.role,
        previousData: existingUser,
        newData: user,
        description: `User ${userId} updated by Admin ${req.user?.id}`,
        ipAddress: req.ip
      });

      res.json({ message: "User updated successfully", user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
