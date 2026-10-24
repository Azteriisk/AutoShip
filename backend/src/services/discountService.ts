import { DiscountResult, MerchantSettings, PromoCode, CloverDiscountMapping } from '../types/index.js';
import { db } from '../db/database.js';

export interface DiscountEvaluationParams {
  cartSubtotal: number;
  originalShippingRate: number;
  promoCode?: string;
  customSettings?: MerchantSettings;
}

export class DiscountService {
  /**
   * Evaluates shipping discount based on merchant free-shipping threshold and optional promo code
   */
  public evaluateDiscount(params: DiscountEvaluationParams): DiscountResult {
    const { cartSubtotal, originalShippingRate, promoCode } = params;
    const settings = params.customSettings || db.getSettings();

    let bestDiscountAmount = 0;
    let ruleApplied: 'threshold' | 'promo_code' | 'none' = 'none';
    let appliedPromoCode: string | undefined = undefined;
    let explanation = 'Standard shipping rate applied';

    // 1. Check Merchant Free Shipping Threshold
    let thresholdDiscount = 0;
    if (
      settings.enableFreeShippingThreshold &&
      cartSubtotal >= settings.freeShippingThreshold
    ) {
      thresholdDiscount = originalShippingRate;
    }

    // 2. Check Promo Code
    let promoDiscount = 0;
    let promoObj: PromoCode | undefined = undefined;

    if (promoCode && promoCode.trim().length > 0) {
      const codeClean = promoCode.trim().toUpperCase();
      promoObj = db.getPromoCodeByCode(codeClean);

      if (promoObj) {
        // Check expiration
        const isExpired = promoObj.expiresAt && new Date(promoObj.expiresAt).getTime() < Date.now();
        const meetsMinOrder = cartSubtotal >= (promoObj.minOrderAmount || 0);

        if (!isExpired && meetsMinOrder) {
          switch (promoObj.discountType) {
            case 'free_shipping':
              promoDiscount = originalShippingRate;
              break;
            case 'percentage':
              promoDiscount = Math.round(originalShippingRate * (promoObj.discountValue / 100) * 100) / 100;
              break;
            case 'fixed_amount':
              promoDiscount = Math.min(originalShippingRate, promoObj.discountValue);
              break;
          }
        }
      }
    }

    // 3. Determine best discount
    if (thresholdDiscount > 0 && thresholdDiscount >= promoDiscount) {
      bestDiscountAmount = thresholdDiscount;
      ruleApplied = 'threshold';
      explanation = `Free Shipping qualified! Cart subtotal ($${cartSubtotal.toFixed(
        2
      )}) exceeds $${settings.freeShippingThreshold.toFixed(2)} threshold.`;
    } else if (promoDiscount > 0) {
      bestDiscountAmount = promoDiscount;
      ruleApplied = 'promo_code';
      appliedPromoCode = promoObj?.code;
      explanation = `Promo code "${promoObj?.code}" applied: ${
        promoObj?.discountType === 'percentage'
          ? `${promoObj.discountValue}% off shipping`
          : promoObj?.discountType === 'fixed_amount'
          ? `$${promoObj.discountValue.toFixed(2)} off shipping`
          : 'Free Shipping'
      }.`;
    } else if (promoCode && !promoObj) {
      explanation = `Promo code "${promoCode}" is invalid or expired.`;
    } else if (promoCode && promoObj && cartSubtotal < promoObj.minOrderAmount) {
      explanation = `Promo code "${promoCode}" requires minimum cart subtotal of $${promoObj.minOrderAmount.toFixed(
        2
      )}.`;
    }

    bestDiscountAmount = Math.min(originalShippingRate, Math.round(bestDiscountAmount * 100) / 100);
    const finalShippingRate = Math.max(0, Math.round((originalShippingRate - bestDiscountAmount) * 100) / 100);

    let cloverMapping: CloverDiscountMapping | undefined = undefined;
    if (bestDiscountAmount > 0) {
      const discountName =
        ruleApplied === 'threshold'
          ? `AutoShip Free Shipping (Order >= $${settings.freeShippingThreshold.toFixed(0)})`
          : `AutoShip Promo: ${appliedPromoCode}`;

      const discountAmountCents = Math.round(bestDiscountAmount * 100);

      cloverMapping = {
        discountName,
        discountAmountCents,
        cloverDiscountPayload: {
          name: discountName,
          amount: -discountAmountCents, // Clover expects negative cents
        },
      };
    }

    return {
      isEligible: bestDiscountAmount > 0,
      ruleApplied,
      promoCode: appliedPromoCode,
      originalShippingRate,
      discountAmount: bestDiscountAmount,
      finalShippingRate,
      explanation,
      cloverMapping,
    };
  }
}

export const discountService = new DiscountService();
