import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authRouter } from "./routes/auth";
import { goldAdvanceRouter } from "./routes/gold_advances";
import { withdrawalRouter } from "./routes/withdrawals";
import { staffRouter } from "./routes/staff";
import { adminRouter } from "./routes/admin";
import { usersRouter } from "./routes/users";
import { walletRouter } from "./routes/wallet";
import { returnRouter } from "./routes/returns";
import { referralRouter } from "./routes/referrals";
import { auditRouter } from "./routes/audit";
import { requireAuth, requireRole } from "./middleware/auth";
import { Role } from "@prisma/client";
import { startDailyReturnCron } from "./cron/dailyProfitCron";
import { SystemSettingController } from "./controllers/SystemSettingController";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "https://royalgoldtraders.com",
    "https://www.royalgoldtraders.com",
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3000"
  ],
  credentials: true,
}));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/gold-advances", goldAdvanceRouter);
app.use("/api/withdrawals", withdrawalRouter);
app.use("/api/staff", staffRouter);
app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/daily-returns", returnRouter);
app.use("/api/referrals", referralRouter);
app.use("/api/audit", auditRouter);

// ── Settings ──────────────────────────────────────────────────────────────────
app.get("/api/settings", SystemSettingController.getSettings);
app.put("/api/settings", requireAuth, requireRole(Role.ADMIN), SystemSettingController.updateSettings);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 RGT API running on http://0.0.0.0:${PORT}`);
  startDailyReturnCron();
});

export default app;
