import { prisma } from "../lib/prisma";
import { Role, AuditAction, TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AuditService } from "./AuditService";

export interface CreateCustomerData {
  name: string;
  email: string;
  password?: string;
  contactNo: string;
  aadharNo?: string;
  pan?: string;
  address?: string;
  photo?: string;
  gender?: string;
  dob?: Date;
  initialGoldAdvanceAmount: number;
  referredBy?: string;
  staffId: string;
  performedByUserId: string;
  performedByRole: Role;
  ipAddress?: string;
}

export class CustomerService {
  /**
   * Onboards a new customer with a wallet and initial gold advance.
   */
  static async onboardCustomer(data: CreateCustomerData) {
    const { 
      name, email, password, contactNo, aadharNo, pan, address, photo, 
      gender, dob, initialGoldAdvanceAmount, referredBy, staffId,
      performedByUserId, performedByRole, ipAddress
    } = data;

    // Default password if not provided
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || "password123", salt);

    return await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: Role.CUSTOMER,
          contactNo,
          mobile: contactNo, // Legacy
          aadharNo,
          aadhar: aadharNo, // Legacy
          pan,
          address,
          photo,
          gender,
          dob,
          initialGoldAdvanceAmount,
          referredBy,
          staffId,
        }
      });

      // 2. Create Wallet
      const wallet = await tx.wallet.create({
        data: {
          userId: user.id,
          goldAdvanceAmount: initialGoldAdvanceAmount,
          totalWithdrawable: initialGoldAdvanceAmount,
        }
      });

      // 3. Create initial GoldAdvance deposit record
      const goldAdvance = await tx.goldAdvance.create({
        data: {
          userId: user.id,
          advanceAmount: initialGoldAdvanceAmount,
          status: "ACTIVE"
        }
      });

      // 4. Create deposit transaction
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: TransactionType.DEPOSIT,
          amount: initialGoldAdvanceAmount,
          balanceAfter: initialGoldAdvanceAmount,
          description: "Initial Gold Advance Deposit"
        }
      });

      // 5. Log Audit record
      await AuditService.logAction({
        actionType: AuditAction.CUSTOMER_CREATED,
        entityType: "User",
        entityId: user.id,
        performedByUserId,
        performedByRole,
        newData: { 
          id: user.id, 
          email: user.email, 
          initialGoldAdvanceAmount 
        },
        description: `Customer ${name} onboarding by ${performedByRole} ${performedByUserId}`,
        ipAddress
      });

      return { user, wallet, goldAdvance };
    });
  }
}
