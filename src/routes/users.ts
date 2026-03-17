import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { Role } from "@prisma/client";
import { getPaginationOptions, formatPaginationResponse } from "../lib/pagination";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// ── GET /api/users/:id ────────────────────────────────────────────────────────
usersRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  if (req.user?.role === Role.CUSTOMER && req.user.id !== req.params.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        wallet: true,
        goldAdvances: true, // Fetch all to calculate totals
        assignedStaff: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    
    const { password: _, ...safeUser } = user;
    
    // Calculate totals
    const activeGoldAdvanceAmount = user.goldAdvances
      .filter(adv => adv.status === "ACTIVE")
      .reduce((sum, adv) => sum + Number(adv.advanceAmount), 0);
      
    const totalGoldAdvanceAmount = user.goldAdvances.reduce((sum, adv) => sum + Number(adv.advanceAmount), 0);
    
    // Flatten wallet fields for frontend compatibility
    const responseData = {
      ...safeUser,
      balance: Number(user.wallet?.totalWithdrawable || 0),
      profitBalance: Number(user.wallet?.profitAmount || 0),
      referralBalance: Number(user.wallet?.referralAmount || 0),
      commissionBalance: Number(user.wallet?.staffCommissionBalance || 0),
      activeGoldAdvanceAmount,
      totalGoldAdvanceAmount // Now represents the historical sum
    };

    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ── POST /api/users ───────────────────────────────────────────────────────────
// Staff/Admin creates a new customer account
usersRouter.post("/", requireRole(Role.STAFF, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const { name, mobile, email, password, aadhar, pan } = req.body as {
    name: string; mobile: string; email: string; password: string; aadhar?: string; pan?: string;
  };

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { res.status(409).json({ error: "Email already registered" }); return; }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        mobile,
        aadhar,
        pan,
        staffId: req.user!.role === Role.STAFF ? req.user!.id : undefined,
      },
    });

    const { password: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ── GET /api/users/:id/transactions ───────────────────────────────────────────
usersRouter.get("/:id/transactions", async (req: AuthRequest, res: Response) => {
  if (req.user?.role === Role.CUSTOMER && req.user.id !== req.params.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const { skip, take, page, limit } = getPaginationOptions(req);
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.params.id },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      prisma.transaction.count({ where: { userId: req.params.id } })
    ]);
    res.json(formatPaginationResponse(transactions, total, page, limit));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});
