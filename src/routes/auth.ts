import { Router } from "express";
import { AuthController } from "../controllers/AuthController";

export const authRouter = Router();

// ── POST /api/auth/register ──────────────────────────────────────────────────
authRouter.post("/register", AuthController.register);

// ── POST /api/auth/login ─────────────────────────────────────────────────────
authRouter.post("/login", AuthController.login);

// ── GET /api/auth/lookup-referrer ─────────────────────────────────────────────
authRouter.get("/lookup-referrer", AuthController.lookupReferrer);
