import { db } from '../db/database.js';

export interface CreateChargeParams {
  amount: number; // in cents
  currency?: string; // 'usd'
  source: string; // token 'clv_1TST...'
  description?: string;
  orderId?: string;
  customerEmail?: string;
}

export interface ChargeResult {
  id: string;
  amount: number;
  paid: boolean;
  status: string;
  created: number;
  currency: string;
  source: {
    brand: string;
    last4: string;
    expMonth: string;
    expYear: string;
  };
}

export class CloverEcommerceService {
  private apiToken: string;
  private baseUrl: string;

  constructor() {
    this.apiToken = process.env.CLOVER_API_TOKEN || '';
    const env = process.env.CLOVER_ENV || 'sandbox';
    this.baseUrl =
      env === 'production'
        ? 'https://scl.clover.com/v1'
        : 'https://scl-sandbox.dev.clover.com/v1';
  }

  /**
   * Process a direct card-not-present payment charge via Clover Ecommerce API
   */
  public async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    const token = this.apiToken || db.getSettings().cloverApiToken;

    if (!token) {
      throw new Error(
        'Clover Ecommerce API Token is not configured. Please connect your Clover Merchant account.'
      );
    }

    const payload = {
      amount: params.amount,
      currency: params.currency || 'usd',
      source: params.source,
      description: params.description || 'AutoShip Shipping & Fulfillment',
      metadata: {
        orderId: params.orderId,
      },
      receipt_email: params.customerEmail,
    };

    const res = await fetch(`${this.baseUrl}/charges`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Clover Ecommerce charge failed (${res.status}): ${err}`);
    }

    return (await res.json()) as ChargeResult;
  }

  /**
   * Generates a Pay-By-Link session for remote phone / social orders
   */
  public async generatePaymentLink(orderId: string, amountCents: number, customerPhoneOrEmail: string): Promise<{ paymentUrl: string; expiresAt: string }> {
    const siteUrl = process.env.SITE_URL || 'https://autoship.azterisk.net';
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return {
      paymentUrl: `${siteUrl}/checkout/pay?orderId=${encodeURIComponent(orderId)}&amt=${amountCents}`,
      expiresAt: expires,
    };
  }
}

export const cloverEcommerceService = new CloverEcommerceService();
