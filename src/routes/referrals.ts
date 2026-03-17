import { Router } from "express";
import { ReferralController } from "../controllers/ReferralController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, ReferralController.list);

export { router as referralRouter };
