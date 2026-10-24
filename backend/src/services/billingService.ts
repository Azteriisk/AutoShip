import { db } from '../db/database.js';
import { PlanTier, PlanConfig } from '../types/index.js';

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  pay_as_you_go: {
    tier: 'pay_as_you_go',
    name: 'Pay-As-You-Ship',
    monthlyPrice: 0.0,
    includedShipments: 0,
    overageRate: 0.49,
    meteredId: process.env.CLOVER_METERED_PAY_AS_YOU_GO || '773EXH96X3B2M',
    planId: 'GPYEA178Y1NDC',
    features: {
      freeShippingThreshold: false,
      customMarkup: false,
      customCarrierAccounts: false,
      priorityTracking: false,
    },
  },
  growth: {
    tier: 'growth',
    name: 'Growth Plan',
    monthlyPrice: 6.99,
    includedShipments: 100,
    overageRate: 0.15,
    meteredId: process.env.CLOVER_METERED_GROWTH_POST_LIMIT || '6YFSNCHF511Q6',
    planId: 'YC22908RFMB50',
    features: {
      freeShippingThreshold: true,
      customMarkup: true,
      customCarrierAccounts: false,
      priorityTracking: false,
    },
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise Plan',
    monthlyPrice: 59.99,
    includedShipments: 1000,
    overageRate: 0.06,
    meteredId: process.env.CLOVER_METERED_ENTERPRISE_POST_LIMIT || 'BO4NPAZ1WVVMP',
    planId: 'W9AMRPTJFDM8T',
    features: {
      freeShippingThreshold: true,
      customMarkup: true,
      customCarrierAccounts: true,
      priorityTracking: true,
    },
  },
};

export class CloverBillingService {
  private appId: string;
  private baseUrl: string;

  constructor() {
    this.appId = process.env.CLOVER_APP_ID || '5H39JNZX2YWGC';
    const env = process.env.CLOVER_ENV || 'production';
    this.baseUrl =
      env === 'production'
        ? 'https://api.clover.com/v3'
        : 'https://apisandbox.dev.clover.com/v3';
  }

  /**
   * Reports a metered usage event (e.g. 1 shipping label) to Clover billing
   */
  public async reportMeteredEvent(params: {
    merchantId: string;
    meteredId: string;
    count?: number;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const { merchantId, meteredId, count = 1 } = params;
    const token = process.env.CLOVER_API_TOKEN || db.getSettings().cloverApiToken;

    if (process.env.NODE_ENV === 'test') {
      return { success: true, data: { status: 'recorded', merchantId, meteredId, count } };
    }

    if (!token) {
      console.warn(`[AutoShip Billing] Clover API token not configured. Metered billing event skipped for metered ID: ${meteredId}`);
      return { success: false, error: 'Clover API token is not configured' };
    }

    try {
      const url = `${this.baseUrl}/merchants/${merchantId}/apps/${this.appId}/metereds/${meteredId}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Clover Metered Billing] Failed to report event (${res.status}):`, errText);
        return { success: false, error: errText };
      }

      const data = await res.json();
      console.log(`[Clover Metered Billing] Successfully reported ${count} event(s) on metered ID: ${meteredId}`);
      return { success: true, data };
    } catch (err: any) {
      console.error('[Clover Metered Billing] Network error reporting event:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Processes billing for a newly fulfilled shipment based on the merchant's active tier
   */
  public async processShipmentBilling(merchantId?: string): Promise<{
    tier: PlanTier;
    currentCount: number;
    includedShipments: number;
    isOverage: boolean;
    meteredId?: string;
    billed: boolean;
  }> {
    const settings = db.getSettings();
    const tier = settings.planTier || 'growth';
    const plan = PLAN_CONFIGS[tier];

    // Current billing month (YYYY-MM)
    const currentMonth = new Date().toISOString().substring(0, 7);
    const lastMonth = settings.billingCycleMonth || currentMonth;

    let count = (lastMonth === currentMonth ? (settings.shipmentsCountThisMonth || 0) : 0) + 1;

    // Update settings in database
    db.updateSettings({
      billingCycleMonth: currentMonth,
      shipmentsCountThisMonth: count,
    });

    let isOverage = false;
    let meteredId: string | undefined = undefined;

    if (tier === 'pay_as_you_go') {
      // Pay-As-You-Ship bills every single label ($0.49/label)
      isOverage = true;
      meteredId = plan.meteredId;
    } else {
      // Growth (100 free) or Enterprise (1,000 free)
      if (count > plan.includedShipments) {
        isOverage = true;
        meteredId = plan.meteredId;
      }
    }

    let billed = false;
    if (meteredId) {
      const res = await this.reportMeteredEvent({
        merchantId: settings.merchantId || merchantId || 'MERCHANT_CLOVER_12345',
        meteredId,
        count: 1,
      });
      billed = res.success;
    }

    return {
      tier,
      currentCount: count,
      includedShipments: plan.includedShipments,
      isOverage,
      meteredId,
      billed,
    };
  }

  /**
   * Helper to resolve the correct metered ID based on merchant tier
   */
  public getMeteredIdForTier(tier: PlanTier): string {
    return PLAN_CONFIGS[tier].meteredId;
  }

  /**
   * Get plan configuration details
   */
  public getPlanConfig(tier: PlanTier): PlanConfig {
    return PLAN_CONFIGS[tier];
  }
}

export const cloverBillingService = new CloverBillingService();
