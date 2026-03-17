import { Router } from "express";
import { ReturnController } from "../controllers/ReturnController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, ReturnController.getMyReturns);
router.get("/referrals", requireAuth, ReturnController.getMyReferralRewards);

export { router as returnRouter };
