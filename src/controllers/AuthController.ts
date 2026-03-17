import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { Role } from "@prisma/client";
import { z, ZodError } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.nativeEnum(Role).optional(),
  referredBy: z.string().optional().nullable(),
  staffId: z.string().optional().nullable(),
  contactNo: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  aadharNo: z.string().length(12, "Aadhar must be 12 digits").optional().nullable(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format").optional().nullable(),
  address: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  initialGoldAdvanceAmount: z.number().min(0).default(0),
});

import { CustomerService } from "../services/CustomerService";

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      // 1. Validate Input
      const validatedData = registerSchema.parse(req.body);

      const {
        name, email, password, role, referredBy: rawReferredBy,
        staffId: rawStaffId, contactNo, aadharNo, pan,
        address, photo, gender, dob, initialGoldAdvanceAmount
      } = validatedData;

      let finalRole = role || Role.CUSTOMER;
      let finalStaffId = rawStaffId === "" ? null : rawStaffId;
      const referredBy = rawReferredBy === "" ? null : rawReferredBy;

      // ── Permissions Check ──────────────────────────────────────────────────
      const authHeader = req.headers.authorization;
      let creator: any = null;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.split(" ")[1];
          creator = jwt.verify(token, process.env.JWT_SECRET!) as any;
        } catch (e) { }
      }

      if (creator) {
        if (creator.role === Role.STAFF) {
          if (finalRole !== Role.CUSTOMER) {
            return res.status(403).json({ error: "Staff can only register customers" });
          }
          finalStaffId = creator.id;
        }
      } else {
        if (finalRole !== Role.CUSTOMER) {
          return res.status(403).json({ error: "Public registration only allowed for customers" });
        }
      }

      // Check for existing user
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { contactNo }
          ]
        }
      });
      if (existingUser) {
        return res.status(400).json({
          error: existingUser.email === email ? "Email already in use" : "Contact number already in use"
        });
      }

      // 2. Delegate to CustomerService
      const result = await CustomerService.onboardCustomer({
        name,
        email,
        password,
        contactNo,
        aadharNo: aadharNo || undefined,
        pan: pan || undefined,
        address: address || undefined,
        photo: photo || undefined,
        gender: gender || undefined,
        dob: dob ? new Date(dob) : undefined,
        initialGoldAdvanceAmount: Number(initialGoldAdvanceAmount),
        referredBy: referredBy || undefined,
        staffId: finalStaffId || "SYSTEM", // Fallback if no staff assigned
        performedByUserId: creator?.id || "PUBLIC",
        performedByRole: creator?.role || Role.CUSTOMER,
        ipAddress: req.ip
      });

      res.status(201).json({
        message: "Customer onboarded successfully",
        userId: result.user.id,
        walletId: result.wallet.id
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: error.issues[0]?.message || "Validation error"
        });
      }

      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async login(req: Request, res: Response) {
    const { email, password } = req.body;

    try {
      const user: any = await prisma.user.findUnique({
        where: { email },
        include: {
          wallet: true,
          goldAdvances: { where: { status: "ACTIVE" } }
        }
      });
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as any }
      );

      const totalGoldAdvanceAmount = user.goldAdvances?.reduce((sum: number, adv: any) => sum + Number(adv.advanceAmount), 0) || 0;

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        contactNo: user.contactNo,
        goldAdvanceAmount: totalGoldAdvanceAmount,
        wallet: {
          goldAdvanceAmount: Number(user.wallet?.goldAdvanceAmount || 0),
          profitAmount: Number(user.wallet?.profitAmount || 0),
          referralAmount: Number(user.wallet?.referralAmount || 0),
          totalWithdrawable: Number(user.wallet?.totalWithdrawable || 0),
        }
      };

      res.json({ token, user: safeUser });
    } catch (error: any) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async lookupReferrer(req: Request, res: Response) {
    const { mobile } = req.query;
    if (!mobile) return res.status(400).json({ error: "Mobile number is required" });

    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { contactNo: mobile as string },
            { mobile: mobile as string }
          ]
        },
        select: { id: true, name: true }
      });

      if (!user) return res.status(404).json({ error: "Referrer not found with this mobile number" });

      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
