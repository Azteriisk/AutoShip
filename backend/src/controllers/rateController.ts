import { Request, Response } from 'express';
import { z } from 'zod';
import { rateCalculationService } from '../services/rateCalculationService.js';
import { db } from '../db/database.js';

const rateRequestSchema = z.object({
  fromAddress: z
    .object({
      name: z.string().optional(),
      company: z.string().optional(),
      street1: z.string(),
      street2: z.string().optional(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      country: z.string().default('US'),
      phone: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  toAddress: z.object({
    name: z.string().default('Customer'),
    company: z.string().optional(),
    street1: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default('US'),
    phone: z.string().optional(),
    email: z.string().optional(),
    isResidential: z.boolean().optional(),
  }),
  items: z.array(
    z.object({
      id: z.string().optional(),
      sku: z.string().optional(),
      name: z.string(),
      quantity: z.number().int().positive().default(1),
      price: z.number().nonnegative().default(0),
      weightOz: z.number().positive(),
      lengthIn: z.number().positive(),
      widthIn: z.number().positive(),
      heightIn: z.number().positive(),
    })
  ).min(1, 'At least one item is required'),
  cartSubtotal: z.number().nonnegative().default(0),
  insuranceRequested: z.boolean().optional().default(false),
  declaredValue: z.number().nonnegative().optional(),
  deliveryGuaranteeRequested: z.boolean().optional().default(false),
  promoCode: z.string().optional(),
});

export class RateController {
  public static async calculate(req: Request, res: Response): Promise<void> {
    try {
      // If client sends standalone package instead of items array, construct item
      if (!req.body.items && req.body.package) {
        const pkg = req.body.package;
        const weightOz = Math.max(1, (pkg.weightLbs || 1) * 16);
        req.body.items = [
          {
            id: 'standalone_pkg',
            name: pkg.presetName || 'Custom Parcel',
            quantity: 1,
            price: req.body.cartSubtotal || 0,
            weightOz,
            lengthIn: pkg.lengthIn || 10,
            widthIn: pkg.widthIn || 7,
            heightIn: pkg.heightIn || 5,
          },
        ];
      }

      const parsed = rateRequestSchema.parse(req.body);
      const quote = await rateCalculationService.calculateRates({
        ...parsed,
        fromAddress: parsed.fromAddress as any,
        toAddress: parsed.toAddress as any,
        items: parsed.items as any,
      });

      res.status(200).json({
        success: true,
        data: quote,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: err.errors,
        });
        return;
      }

      console.error('Rate calculation error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error calculating shipping rates',
      });
    }
  }

  public static async getBoxes(req: Request, res: Response): Promise<void> {
    try {
      const presets = db.getPresets();
      const catalog = db.getCatalog();
      res.status(200).json({
        success: true,
        presets,
        catalog,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
}
