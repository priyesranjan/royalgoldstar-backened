import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export class SystemSettingController {
  static async getSettings(req: Request, res: Response) {
    try {
      let settings = await prisma.systemSetting.findUnique({
        where: { id: "default" }
      });

      if (!settings) {
        settings = await prisma.systemSetting.create({
          data: {
            id: "default",
            showGST: true,
            gstPercentage: 18.0
          }
        });
      }

      res.status(200).json(settings);
    } catch (err: any) {
      console.error("❌ [SystemSettingController] Error fetching settings:", err);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  }

  static async updateSettings(req: Request, res: Response) {
    try {
      const { showGST, gstPercentage } = req.body;

      const settings = await prisma.systemSetting.upsert({
        where: { id: "default" },
        update: {
          showGST: showGST ?? true,
          gstPercentage: gstPercentage ?? 18.0,
        },
        create: {
          id: "default",
          showGST: showGST ?? true,
          gstPercentage: gstPercentage ?? 18.0,
        }
      });

      res.status(200).json(settings);
    } catch (err: any) {
      console.error("❌ [SystemSettingController] Error updating settings:", err);
      res.status(500).json({ error: "Failed to update settings" });
    }
  }
}
