import { describe, it, expect } from 'vitest';
import { rateCalculationService } from '../src/services/rateCalculationService.js';
import { RateQuoteRequest } from '../src/types/index.js';

describe('RateCalculationService', () => {
  const sampleRequest: RateQuoteRequest = {
    toAddress: {
      name: 'John Doe',
      street1: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      country: 'US',
    },
    items: [
      {
        id: 'mug_1',
        name: 'Ceramic Mug',
        quantity: 2,
        price: 18.0,
        weightOz: 14.0,
        lengthIn: 4.5,
        widthIn: 4.5,
        heightIn: 4.5,
      },
    ],
    cartSubtotal: 36.0,
    insuranceRequested: false,
  };

  it('should calculate rates across USPS and FedEx', async () => {
    const quote = await rateCalculationService.calculateRates(sampleRequest);

    expect(quote.rates.length).toBeGreaterThanOrEqual(2);
    const carriers = quote.rates.map((r) => r.carrier);
    expect(carriers).toContain('USPS');
    expect(carriers).toContain('FedEx');

    // Should designate cheapest and fastest
    expect(quote.cheapestRateId).toBeDefined();
    expect(quote.fastestRateId).toBeDefined();

    const cheapest = quote.rates.find((r) => r.id === quote.cheapestRateId);
    expect(cheapest?.badge).toBe('Cheapest');
  });

  it('should calculate insurance fee for high declared values', async () => {
    const highValueRequest: RateQuoteRequest = {
      ...sampleRequest,
      insuranceRequested: true,
      declaredValue: 350.0, // $250 excess -> Math.ceil(250/100) = 3 hundred-blocks * $1.05 = $3.15
    };

    const quote = await rateCalculationService.calculateRates(highValueRequest);

    expect(quote.insurance.requested).toBe(true);
    expect(quote.insurance.declaredValue).toBe(350.0);
    expect(quote.insurance.fee).toBe(3.15);

    for (const r of quote.rates) {
      expect(r.insuranceFee).toBe(3.15);
      expect(r.finalCustomerRate).toBeGreaterThanOrEqual(r.baseRate);
    }
  });

  it('should apply delivery guarantee fee when requested', async () => {
    const guaranteeRequest: RateQuoteRequest = {
      ...sampleRequest,
      deliveryGuaranteeRequested: true,
    };

    const quote = await rateCalculationService.calculateRates(guaranteeRequest);

    expect(quote.deliveryGuarantee.requested).toBe(true);
    expect(quote.deliveryGuarantee.fee).toBe(2.99);

    // Non-guaranteed ground services should have the guarantee fee added
    const nonGuaranteed = quote.rates.find((r) => !r.guaranteedDelivery);
    expect(nonGuaranteed?.deliveryGuaranteeFee).toBe(2.99);
  });

  it('should calculate future business delivery dates', async () => {
    const quote = await rateCalculationService.calculateRates(sampleRequest);

    for (const rate of quote.rates) {
      expect(rate.estimatedDeliveryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const deliveryDate = new Date(rate.estimatedDeliveryDate);
      const today = new Date();
      expect(deliveryDate.getTime()).toBeGreaterThanOrEqual(today.setHours(0, 0, 0, 0));
    }
  });
});
