import { prisma } from "../lib/prisma";
import { TransactionType, GoldAdvanceStatus, AuditAction } from "@prisma/client";
import { WalletService } from "./WalletService";
import { AuditService } from "./AuditService";
import { InvoiceService } from "./InvoiceService";
import * as fs from "fs";
import * as path from "path";

export class GoldAdvanceService {
  private static readonly INVOICE_DIR = path.join(process.cwd(), "storage", "invoices", "gold-advances");

  private static async saveInvoice(id: string, html: string) {
    try {
      if (!fs.existsSync(this.INVOICE_DIR)) {
        fs.mkdirSync(this.INVOICE_DIR, { recursive: true });
      }
      const filePath = path.join(this.INVOICE_DIR, `${id}.html`);
      fs.writeFileSync(filePath, html);
      console.log(`✅ [GoldAdvanceService] Invoice saved: ${filePath}`);
    } catch (error) {
      console.error(`❌ [GoldAdvanceService] Error saving invoice:`, error);
    }
  }

  /**
   * Create a new gold advance for a customer (Customer initiated)
   */
  static async createGoldAdvance(userId: string, amount: number) {
    const result = await prisma.$transaction(async (tx) => {
      // ... existing logic ...
      const wallet = await WalletService.getOrCreateWallet(userId, tx);
      if (Number(wallet.totalWithdrawable) < amount) {
        throw new Error("Insufficient balance");
      }

      await WalletService.updateBalance(userId, { 
        goldAdvanceAmount: amount 
      }, tx);

      const goldAdvance = await tx.goldAdvance.create({
        data: {
          userId,
          advanceAmount: amount,
          status: GoldAdvanceStatus.ACTIVE,
        },
      });

      const updatedWallet = await WalletService.getOrCreateWallet(userId, tx);
      const balanceAfter = Number(updatedWallet.totalWithdrawable);

      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.DEPOSIT,
          amount,
          description: `Gold Advance of ${amount} created from wallet balance. Ref: #${goldAdvance.id}`,
          balanceAfter,
        },
      });

      await AuditService.logAction({
        actionType: AuditAction.GOLD_ADVANCE_DEPOSITED,
        entityType: "GoldAdvance",
        entityId: goldAdvance.id,
        performedByUserId: userId,
        newData: goldAdvance as any,
        description: `Gold advance of ${amount} created by customer`
      });

      return goldAdvance;
    });

    // Generate Invoice
    const html = await InvoiceService.generateGoldAdvanceInvoiceHtml(result.id);
    await this.saveInvoice(result.id, html);

    return result;
  }

  /**
   * Create a manual gold advance for a customer (e.g. by Admin or Staff)
   */
  static async createManualGoldAdvance(userId: string, amount: number, performedByUserId: string, description: string = "Manual gold advance recorded") {
    const result = await prisma.$transaction(async (tx) => {
      await WalletService.updateBalance(userId, { 
        goldAdvanceAmount: amount,
      }, tx);

      const goldAdvance = await tx.goldAdvance.create({
        data: {
          userId,
          advanceAmount: amount,
          status: GoldAdvanceStatus.ACTIVE,
        },
      });

      const wallet = await WalletService.getOrCreateWallet(userId, tx);
      const balanceAfter = Number(wallet.totalWithdrawable);

      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.DEPOSIT,
          amount,
          description: description.includes("#") ? description : `${description}. Ref: #${goldAdvance.id}`,
          balanceAfter,
        },
      });

      await AuditService.logAction({
        actionType: AuditAction.GOLD_ADVANCE_DEPOSITED,
        entityType: "GoldAdvance",
        entityId: goldAdvance.id,
        performedByUserId: performedByUserId,
        newData: goldAdvance as any,
        description: `Manual gold advance of ${amount} recorded by ${performedByUserId}`
      });

      return goldAdvance;
    });

    // Generate Invoice
    const html = await InvoiceService.generateGoldAdvanceInvoiceHtml(result.id);
    await this.saveInvoice(result.id, html);

    return result;
  }

  /**
   * Get all gold advances for a user
   */
  static async getUserGoldAdvances(userId: string) {
    return await prisma.goldAdvance.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get all active gold advances (for profit distribution)
   */
  static async getAllActiveGoldAdvances() {
    return await prisma.goldAdvance.findMany({
      where: { status: GoldAdvanceStatus.ACTIVE },
      include: {
        user: {
          select: {
            id: true,
            referredBy: true,
            staffId: true,
          },
        },
      },
    });
  }
}
