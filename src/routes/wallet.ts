import { Router } from "express";
import { WalletController } from "../controllers/WalletController";
import { requireAuth, requireRole } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", requireAuth, WalletController.getMyWallet);
router.get("/all", requireAuth, requireRole(Role.ADMIN), WalletController.getAllWallets);

export { router as walletRouter };
