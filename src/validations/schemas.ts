import { z } from "zod";
import { WithdrawalSource } from "@prisma/client";

export const CreateGoldAdvanceSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
});

export const CreateManualGoldAdvanceSchema = z.object({
  userId: z.string().cuid("Invalid User ID"),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().optional(),
});

export const CreateWithdrawalRequestSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  source: z.nativeEnum(WithdrawalSource).optional(),
});
