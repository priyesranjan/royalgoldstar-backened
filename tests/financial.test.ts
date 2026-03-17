import { ReturnDistributionService } from "../src/services/ReturnDistributionService";
import { prisma } from "../src/lib/prisma";
import { WalletService } from "../src/services/WalletService";

jest.mock("../src/lib/prisma", () => ({
  prisma: {
    goldAdvance: {
      findMany: jest.fn(),
    },
    dailyProfitLog: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(prisma)),
    transaction: {
      create: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("ReturnDistributionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should calculate daily return correctly (5% monthly / 30 days)", async () => {
    const advanceAmount = 10000;
    const expectedDailyReturn = Number(((10000 * 0.05) / 30).toFixed(2)); // 16.67
    
    expect(expectedDailyReturn).toBe(16.67);

    (prisma.dailyProfitLog.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.goldAdvance.findMany as jest.Mock).mockResolvedValue([
      {
        id: "adv_1",
        userId: "user_1",
        advanceAmount: advanceAmount,
        user: { id: "user_1", referredBy: null, staffId: null },
      },
    ]);

    const updateBalanceSpy = jest.spyOn(WalletService, "updateBalance").mockResolvedValue({} as any);

    await ReturnDistributionService.distributeDailyReturns();

    expect(updateBalanceSpy).toHaveBeenCalledWith("user_1", { dailyReturnBalance: 16.67 }, expect.anything());
  });

  it("should distribute rewards to referrer and staff if present", async () => {
    (prisma.dailyProfitLog.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.goldAdvance.findMany as jest.Mock).mockResolvedValue([
      {
        id: "adv_2",
        userId: "customer_1",
        advanceAmount: 10000,
        user: { id: "customer_1", referredBy: "referrer_1", staffId: "staff_1" },
      },
    ]);

    const updateBalanceSpy = jest.spyOn(WalletService, "updateBalance").mockResolvedValue({} as any);

    await ReturnDistributionService.distributeDailyReturns();

    // 1. Customer return
    expect(updateBalanceSpy).toHaveBeenCalledWith("customer_1", { dailyReturnBalance: 16.67 }, expect.anything());
    // 2. Referrer reward
    expect(updateBalanceSpy).toHaveBeenCalledWith("referrer_1", { referralBalance: 16.67 }, expect.anything());
    // 3. Staff commission
    expect(updateBalanceSpy).toHaveBeenCalledWith("staff_1", { staffCommissionBalance: 16.67 }, expect.anything());
  });
});
