import { describe, it, expect, beforeEach } from 'vitest';
import { cloverBillingService, PLAN_CONFIGS } from '../src/services/billingService.js';
import { db } from '../src/db/database.js';

describe('Tiered Subscription & Metered Billing Service', () => {
  beforeEach(() => {
    db.updateSettings({
      planTier: 'growth',
      billingCycleMonth: new Date().toISOString().substring(0, 7),
      shipmentsCountThisMonth: 0,
    });
  });

  it('correctly maps plan configuration and limits for all 3 tiers', () => {
    const payAsYouGo = cloverBillingService.getPlanConfig('pay_as_you_go');
    expect(payAsYouGo.monthlyPrice).toBe(0.0);
    expect(payAsYouGo.includedShipments).toBe(0);
    expect(payAsYouGo.overageRate).toBe(0.49);
    expect(payAsYouGo.meteredId).toBe('773EXH96X3B2M');

    const growth = cloverBillingService.getPlanConfig('growth');
    expect(growth.monthlyPrice).toBe(6.99);
    expect(growth.includedShipments).toBe(100);
    expect(growth.overageRate).toBe(0.15);
    expect(growth.meteredId).toBe('6YFSNCHF511Q6');

    const enterprise = cloverBillingService.getPlanConfig('enterprise');
    expect(enterprise.monthlyPrice).toBe(59.99);
    expect(enterprise.includedShipments).toBe(1000);
    expect(enterprise.overageRate).toBe(0.06);
    expect(enterprise.meteredId).toBe('BO4NPAZ1WVVMP');
  });

  it('charges metered billing on every shipment for Pay-As-You-Ship tier', async () => {
    db.updateSettings({ planTier: 'pay_as_you_go', shipmentsCountThisMonth: 0 });

    const result = await cloverBillingService.processShipmentBilling('MERCHANT_TEST');
    expect(result.tier).toBe('pay_as_you_go');
    expect(result.currentCount).toBe(1);
    expect(result.isOverage).toBe(true);
    expect(result.meteredId).toBe('773EXH96X3B2M');
    expect(result.billed).toBe(true);
  });

  it('does NOT charge metered billing within Growth tier allowance (first 100 shipments)', async () => {
    db.updateSettings({ planTier: 'growth', shipmentsCountThisMonth: 50 });

    const result = await cloverBillingService.processShipmentBilling('MERCHANT_TEST');
    expect(result.tier).toBe('growth');
    expect(result.currentCount).toBe(51);
    expect(result.isOverage).toBe(false);
    expect(result.meteredId).toBeUndefined();
  });

  it('charges metered overage on Growth tier once shipments exceed 100', async () => {
    db.updateSettings({ planTier: 'growth', shipmentsCountThisMonth: 100 });

    const result = await cloverBillingService.processShipmentBilling('MERCHANT_TEST');
    expect(result.tier).toBe('growth');
    expect(result.currentCount).toBe(101);
    expect(result.isOverage).toBe(true);
    expect(result.meteredId).toBe('6YFSNCHF511Q6');
    expect(result.billed).toBe(true);
  });

  it('charges metered overage on Enterprise tier once shipments exceed 1,000', async () => {
    db.updateSettings({ planTier: 'enterprise', shipmentsCountThisMonth: 1000 });

    const result = await cloverBillingService.processShipmentBilling('MERCHANT_TEST');
    expect(result.tier).toBe('enterprise');
    expect(result.currentCount).toBe(1001);
    expect(result.isOverage).toBe(true);
    expect(result.meteredId).toBe('BO4NPAZ1WVVMP');
    expect(result.billed).toBe(true);
  });
});
