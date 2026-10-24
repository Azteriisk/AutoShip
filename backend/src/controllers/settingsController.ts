import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { PackagePreset, PromoCode } from '../types/index.js';
import { cloverBillingService } from '../services/billingService.js';

export class SettingsController {
  public static async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = db.getSettings();
      const planTier = settings.planTier || 'growth';
      const planConfig = cloverBillingService.getPlanConfig(planTier);

      // Mask API key partially for security when sending to frontend
      const maskedSettings = {
        ...settings,
        planConfig,
        easyPostApiKeyMasked: settings.easyPostApiKey
          ? `${settings.easyPostApiKey.substring(0, 4)}...${settings.easyPostApiKey.substring(
              settings.easyPostApiKey.length - 4
            )}`
          : '',
      };
      res.status(200).json({ success: true, data: maskedSettings });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const updates = req.body;
      const updated = db.updateSettings(updates);
      res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        data: updated,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async syncSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { cloverService } = await import('../services/cloverService.js');
      const result = await cloverService.syncMerchantSubscription();
      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Packaging Presets
  public static async getPresets(req: Request, res: Response): Promise<void> {
    try {
      const presets = db.getPresets();
      res.status(200).json({ success: true, data: presets });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async savePreset(req: Request, res: Response): Promise<void> {
    try {
      const preset: PackagePreset = {
        ...req.body,
        id: req.body.id || `preset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      };
      const saved = db.savePreset(preset);
      res.status(200).json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async deletePreset(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = db.deletePreset(id);
      if (!success) {
        res.status(404).json({ success: false, error: 'Preset not found' });
        return;
      }
      res.status(200).json({ success: true, message: 'Preset deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Promo Codes
  public static async getPromoCodes(req: Request, res: Response): Promise<void> {
    try {
      const promos = db.getPromoCodes();
      res.status(200).json({ success: true, data: promos });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async savePromoCode(req: Request, res: Response): Promise<void> {
    try {
      const promo: PromoCode = {
        ...req.body,
        id: req.body.id || `promo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        code: (req.body.code || '').trim().toUpperCase(),
        usageCount: req.body.usageCount || 0,
        active: req.body.active !== undefined ? req.body.active : true,
      };
      const saved = db.savePromoCode(promo);
      res.status(200).json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async deletePromoCode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = db.deletePromoCode(id);
      if (!success) {
        res.status(404).json({ success: false, error: 'Promo code not found' });
        return;
      }
      res.status(200).json({ success: true, message: 'Promo code deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
