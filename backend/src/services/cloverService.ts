import { CloverOrder, Address } from '../types/index.js';
import { db } from '../db/database.js';

export interface CloverConfig {
  merchantId?: string;
  apiToken?: string;
  environment?: 'sandbox' | 'production';
}

export class CloverService {
  private merchantId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor(config?: CloverConfig) {
    this.merchantId = config?.merchantId || process.env.CLOVER_MERCHANT_ID || 'MERCHANT_CLOVER_12345';
    this.apiToken = config?.apiToken || process.env.CLOVER_API_TOKEN || '';
    const env = config?.environment || (process.env.CLOVER_ENV === 'production' ? 'production' : 'sandbox');
    this.baseUrl =
      env === 'production'
        ? `https://api.clover.com/v3/merchants/${this.merchantId}`
        : `https://apisandbox.dev.clover.com/v3/merchants/${this.merchantId}`;
  }

  /**
   * Retrieves order from Clover REST API
   */
  public async getOrder(orderId: string): Promise<CloverOrder> {
    const token = this.apiToken || db.getSettings().cloverApiToken;
    if (!token) {
      throw new Error(
        'Clover API Token is not configured. Please authorize AutoShip via OAuth in Clover App Market.'
      );
    }

    const res = await fetch(`${this.baseUrl}/orders/${orderId}?expand=lineItems,discounts,customers`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Clover API order #${orderId} fetch failed with status ${res.status}: ${errText}`);
    }

    return (await res.json()) as CloverOrder;
  }

  /**
   * Adds shipping fee line item to Clover order
   */
  public async addShippingLineItem(
    orderId: string,
    shippingAmountCents: number,
    carrierService: string
  ): Promise<any> {
    const token = this.apiToken || db.getSettings().cloverApiToken;
    if (!token) {
      throw new Error('Clover API Token is not configured.');
    }

    const payload = {
      name: `Shipping: ${carrierService}`,
      price: shippingAmountCents,
    };

    const res = await fetch(`${this.baseUrl}/orders/${orderId}/line_items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to add shipping line item to Clover order #${orderId} (${res.status}): ${errText}`);
    }

    return res.json();
  }

  /**
   * Updates Clover order with custom note / tracking metadata
   */
  public async updateOrderTracking(
    orderId: string,
    trackingNumber: string,
    carrier: string,
    trackingUrl: string
  ): Promise<any> {
    const token = this.apiToken || db.getSettings().cloverApiToken;
    if (!token) {
      return { skipped: true, reason: 'No Clover API token configured' };
    }

    const noteText = `AutoShip Fulfillment | ${carrier} Tracking: ${trackingNumber} | Track: ${trackingUrl}`;

    const res = await fetch(`${this.baseUrl}/orders/${orderId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note: noteText }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[AutoShip Clover] Order tracking update note failed (${res.status}): ${errText}`);
      return { success: false, error: errText };
    }

    return res.json();
  }

  /**
   * Exchanges an OAuth authorization code for a merchant API access token
   */
  public async exchangeOAuthCode(code: string): Promise<{ access_token: string }> {
    const appId = process.env.CLOVER_APP_ID;
    const appSecret = process.env.CLOVER_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error('CLOVER_APP_ID or CLOVER_APP_SECRET is not configured in environment variables');
    }
    const env = process.env.CLOVER_ENV || 'sandbox';
    const oauthUrl =
      env === 'production'
        ? 'https://clover.com/oauth/v2/token'
        : 'https://sandbox.dev.clover.com/oauth/v2/token';

    const res = await fetch(oauthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: appId,
        client_secret: appSecret,
        code,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Clover OAuth exchange failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { access_token: string };
    if (data.access_token) {
      this.apiToken = data.access_token;
      db.updateSettings({ cloverApiToken: data.access_token });
    }
    return data;
  }

  /**
   * Verifies Clover Webhook Signature
   */
  public verifyWebhookSignature(authHeader?: string, verificationCode?: string): boolean {
    const configuredCode = process.env.CLOVER_WEBHOOK_SECRET || 'clover_autoship_secret';
    if (!authHeader) {
      return false;
    }
    return authHeader === configuredCode || authHeader === verificationCode;
  }

  /**
   * Queries Clover API to fetch the merchant's active installed App Market subscription
   */
  public async syncMerchantSubscription(merchantId?: string): Promise<{
    success: boolean;
    planTier: string;
    planName: string;
    details?: any;
    error?: string;
  }> {
    const settings = db.getSettings();
    const mId = merchantId || settings.merchantId;
    const token = this.apiToken || settings.cloverApiToken;
    const appId = process.env.CLOVER_APP_ID || '5H39JNZX2YWGC';

    if (!token) {
      const currentTier = settings.planTier || 'growth';
      const planName =
        currentTier === 'enterprise'
          ? 'Enterprise Plan ($59.99/mo)'
          : currentTier === 'pay_as_you_go'
          ? 'Pay-As-You-Ship ($0.00/mo)'
          : 'Growth Plan ($6.99/mo)';
      return {
        success: true,
        planTier: currentTier,
        planName,
        details: { source: 'database', note: 'Active plan synced from merchant profile' },
      };
    }

    try {
      const url = `${this.baseUrl}/merchants/${mId}/apps/${appId}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, planTier: settings.planTier, planName: 'Unknown', error: errText };
      }

      const data: any = await res.json();
      let detectedTier: 'pay_as_you_go' | 'growth' | 'enterprise' = settings.planTier;
      let planName = 'Growth Plan ($6.99/mo)';

      const planId = data.subscription?.id || data.subscriptionPlan?.id || data.plan?.id || '';
      if (planId.includes('YC22908RFMB50')) {
        detectedTier = 'growth';
        planName = 'Growth Plan ($6.99/mo)';
      } else if (planId.includes('GPYEA178Y1NDC')) {
        detectedTier = 'pay_as_you_go';
        planName = 'Pay-As-You-Ship ($0.00/mo)';
      } else if (planId.includes('W9AMRPTJFDM8T')) {
        detectedTier = 'enterprise';
        planName = 'Enterprise Plan ($59.99/mo)';
      }

      db.updateSettings({ planTier: detectedTier });
      return { success: true, planTier: detectedTier, planName, details: data };
    } catch (err: any) {
      return { success: false, planTier: settings.planTier, planName: 'Unknown', error: err.message };
    }
  }
}

export const cloverService = new CloverService();
