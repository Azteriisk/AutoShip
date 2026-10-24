import { describe, it, expect } from 'vitest';
import { discountService } from '../src/services/discountService.js';
import { db } from '../db/database.js';

describe('DiscountService', () => {
  it('should qualify for free shipping when cart subtotal meets threshold ($100)', () => {
    const result = discountService.evaluateDiscount({
      cartSubtotal: 105.0,
      originalShippingRate: 12.5,
    });

    expect(result.isEligible).toBe(true);
    expect(result.ruleApplied).toBe('threshold');
    expect(result.discountAmount).toBe(12.5);
    expect(result.finalShippingRate).toBe(0.0);
    expect(result.cloverMapping).toBeDefined();
    expect(result.cloverMapping?.discountAmountCents).toBe(1250);
    expect(result.cloverMapping?.cloverDiscountPayload.amount).toBe(-1250);
  });

  it('should not waive shipping if cart subtotal is below threshold', () => {
    const result = discountService.evaluateDiscount({
      cartSubtotal: 45.0,
      originalShippingRate: 9.8,
    });

    expect(result.isEligible).toBe(false);
    expect(result.ruleApplied).toBe('none');
    expect(result.discountAmount).toBe(0.0);
    expect(result.finalShippingRate).toBe(9.8);
    expect(result.cloverMapping).toBeUndefined();
  });

  it('should apply percentage promo code SHIP50 (50% off shipping)', () => {
    const result = discountService.evaluateDiscount({
      cartSubtotal: 35.0, // Meets $25 min
      originalShippingRate: 14.0,
      promoCode: 'SHIP50',
    });

    expect(result.isEligible).toBe(true);
    expect(result.ruleApplied).toBe('promo_code');
    expect(result.promoCode).toBe('SHIP50');
    expect(result.discountAmount).toBe(7.0);
    expect(result.finalShippingRate).toBe(7.0);
    expect(result.cloverMapping?.cloverDiscountPayload.name).toContain('SHIP50');
    expect(result.cloverMapping?.cloverDiscountPayload.amount).toBe(-700);
  });

  it('should apply fixed amount promo code FLAT5 ($5.00 off shipping)', () => {
    const result = discountService.evaluateDiscount({
      cartSubtotal: 50.0,
      originalShippingRate: 8.5,
      promoCode: 'FLAT5',
    });

    expect(result.isEligible).toBe(true);
    expect(result.ruleApplied).toBe('promo_code');
    expect(result.discountAmount).toBe(5.0);
    expect(result.finalShippingRate).toBe(3.5);
  });

  it('should reject promo code if cart subtotal is below minimum order requirement', () => {
    // FLAT5 requires $30 minimum
    const result = discountService.evaluateDiscount({
      cartSubtotal: 15.0,
      originalShippingRate: 8.5,
      promoCode: 'FLAT5',
    });

    expect(result.isEligible).toBe(false);
    expect(result.discountAmount).toBe(0);
    expect(result.finalShippingRate).toBe(8.5);
    expect(result.explanation).toContain('requires minimum cart subtotal');
  });

  it('should handle invalid or nonexistent promo codes gracefully', () => {
    const result = discountService.evaluateDiscount({
      cartSubtotal: 50.0,
      originalShippingRate: 10.0,
      promoCode: 'NONEXISTENT99',
    });

    expect(result.isEligible).toBe(false);
    expect(result.discountAmount).toBe(0);
    expect(result.finalShippingRate).toBe(10.0);
    expect(result.explanation).toContain('invalid or expired');
  });
});
