import { prisma } from "../lib/prisma";
import { TransactionType, WithdrawalStatus, WithdrawalSource, GoldAdvanceStatus, AuditAction } from "@prisma/client";
import { WalletService } from "./WalletService";
import { AuditService } from "./AuditService";
import { InvoiceService } from "./InvoiceService";
import * as fs from "fs";
import * as path from "path";

export class WithdrawalService {
  private static readonly VOUCHER_DIR = path.join(process.cwd(), "storage", "invoices", "withdrawals");

  private static async saveVoucher(id: string, html: string) {
    try {
      if (!fs.existsSync(this.VOUCHER_DIR)) {
        fs.mkdirSync(this.VOUCHER_DIR, { recursive: true });
      }
      const filePath = path.join(this.VOUCHER_DIR, `${id}.html`);
      fs.writeFileSync(filePath, html);
      console.log(`✅ [WithdrawalService] Voucher saved: ${filePath}`);
    } catch (error) {
      console.error(`❌ [WithdrawalService] Error saving voucher:`, error);
    }
  }

  /**
   * Submit a withdrawal request
   */
  static async requestWithdrawal(userId: string, amount: number, source: WithdrawalSource = WithdrawalSource.PROFIT) {
    // ... logic remains same ...
    const wallet = await WalletService.getOrCreateWallet(userId);
    let available = 0;
    if (source === WithdrawalSource.PROFIT) {
      available = Number(wallet.profitAmount);
    } else if (source === WithdrawalSource.REFERRAL) {
      available = Number(wallet.referralAmount);
    } else if (source === WithdrawalSource.BALANCE) {
      available = Number(wallet.totalWithdrawable);
    } else if (source === WithdrawalSource.GOLD_ADVANCE) {
      available = Number(wallet.goldAdvanceAmount);
    }

    if (available < amount) {
      throw new Error(`Insufficient balance in selected source: ${source}`);
    }

    const request = await prisma.withdrawalRequest.create({
      data: {
        userId,
        amount,
        source,
        status: WithdrawalStatus.PENDING,
      },
    });

    await AuditService.logAction({
      actionType: AuditAction.WITHDRAWAL_REQUEST_CREATED,
      entityType: "WithdrawalRequest",
      entityId: request.id,
      performedByUserId: userId,
      newData: request as any,
      description: `Withdrawal request of ${amount} submitted from ${source}`
    });

    return request;
  }

  /**
   * Approve a withdrawal request
   */
  static async approveWithdrawal(requestId: string, adminId: string) {
    const updatedRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({
        where: { id: requestId },
      });

      if (!request || request.status !== WithdrawalStatus.PENDING) {
        throw new Error("Invalid or already processed withdrawal request");
      }

      // 1. Update request status
      const updated = await tx.withdrawalRequest.update({
        where: { id: requestId },
        data: { status: WithdrawalStatus.APPROVED },
      });

      // 2. Deduct from the specific source
      const amountToDeduct = Number(request.amount);

      if (request.source === WithdrawalSource.BALANCE || request.source === WithdrawalSource.PROFIT) {
        await WalletService.updateBalance(request.userId, { profitAmount: -amountToDeduct }, tx);
      } else if (request.source === WithdrawalSource.REFERRAL) {
        await WalletService.updateBalance(request.userId, { referralAmount: -amountToDeduct }, tx);
      } else if (request.source === WithdrawalSource.GOLD_ADVANCE) {
        await WalletService.updateBalance(request.userId, { goldAdvanceAmount: -amountToDeduct }, tx);
        
        const goldAdvances = await tx.goldAdvance.findMany({
          where: { userId: request.userId, status: GoldAdvanceStatus.ACTIVE },
          orderBy: { createdAt: "asc" }
        });

        let remaining = amountToDeduct;
        for (const adv of goldAdvances) {
          if (remaining <= 0) break;
          const advAmt = Number(adv.advanceAmount);
          const toDeduct = Math.min(advAmt, remaining);
          
          if (toDeduct === advAmt) {
            await tx.goldAdvance.update({
              where: { id: adv.id },
              data: { advanceAmount: 0, status: GoldAdvanceStatus.CLOSED }
            });
          } else {
            await tx.goldAdvance.update({
              where: { id: adv.id },
              data: { advanceAmount: { decrement: toDeduct } }
            });
          }
          remaining -= toDeduct;
        }
      }

      // 3. Log transaction
      const updatedWallet = await WalletService.getOrCreateWallet(request.userId, tx);
      const balanceAfter = Number(updatedWallet.totalWithdrawable);

      await tx.transaction.create({
        data: {
          userId: request.userId,
          type: TransactionType.WITHDRAWAL,
          amount: request.amount,
          balanceAfter,
          description: `Withdrawal from ${request.source} approved (Request #${request.id})`,
        },
      });

      // 4. Log Audit
      await AuditService.logAction({
        actionType: AuditAction.WITHDRAWAL_APPROVED,
        entityType: "WithdrawalRequest",
        entityId: requestId,
        performedByUserId: adminId,
        newData: updated as any,
        description: `Withdrawal of ${request.amount} from ${request.source} approved by ${adminId}`
      });

      return updated;
    });

    // Generate Payment Voucher
    const html = await InvoiceService.generateWithdrawalInvoiceHtml(updatedRequest.id);
    await this.saveVoucher(updatedRequest.id, html);

    return updatedRequest;
  }

  /**
   * Reject a withdrawal request
   */
  static async rejectWithdrawal(requestId: string, adminId: string) {
    const updatedRequest = await prisma.withdrawalRequest.update({
      where: { id: requestId },
      data: { status: WithdrawalStatus.REJECTED },
    });

    // Log Audit
    await AuditService.logAction({
      actionType: AuditAction.WITHDRAWAL_REJECTED,
      entityType: "WithdrawalRequest",
      entityId: requestId,
      performedByUserId: adminId,
      newData: updatedRequest as any,
      description: `Withdrawal of ${updatedRequest.amount} rejected by ${adminId}`
    });

    return updatedRequest;
  }
}
