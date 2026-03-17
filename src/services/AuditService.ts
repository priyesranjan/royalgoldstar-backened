import { AuditAction, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface AuditLogOptions {
  actionType: AuditAction;
  entityType: string;
  entityId: string;
  performedByUserId?: string;
  performedByRole?: Role;
  description?: string;
  previousData?: any;
  newData?: any;
  comment?: string;
  ipAddress?: string;
}

export class AuditService {
  /**
   * Logs an action to the AuditLog table.
   */
  static async logAction(options: AuditLogOptions) {
    try {
      await prisma.auditLog.create({
        data: {
          actionType: options.actionType,
          entityType: options.entityType,
          entityId: options.entityId,
          performedByUserId: options.performedByUserId,
          performedByRole: options.performedByRole,
          description: options.description,
          previousData: options.previousData || null,
          newData: options.newData || null,
          comment: options.comment,
          ipAddress: options.ipAddress,
        },
      });
    } catch (error) {
      console.error("Failed to log audit action:", error);
      // We don't throw here to avoid failing the main operation if logging fails
    }
  }
}
