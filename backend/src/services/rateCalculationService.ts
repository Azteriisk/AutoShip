import { v4 as uuidv4 } from 'uuid';
import {
  RateQuoteRequest,
  RateQuoteResponse,
  Address,
  CarrierRate,
} from '../types/index.js';
import { db } from '../db/database.js';
import { binPackingService } from './binPackingService.js';
import { discountService } from './discountService.js';
import { CarrierFactory } from '../carriers/carrierFactory.js';

export class RateCalculationService {
  /**
   * Calculates multi-carrier shipping rates, package box selection, insurance, and discounts
   */
  public async calculateRates(request: RateQuoteRequest): Promise<RateQuoteResponse> {
    const settings = db.getSettings();

    // 1. Resolve Origin Address
    const fromAddress: Address = request.fromAddress || settings.originAddress;
    const toAddress: Address = request.toAddress;

    if (!toAddress || !toAddress.zip) {
      throw new Error('Destination address with valid ZIP code is required');
    }

    // 2. Perform Bin-Packing & Box Selection
    const parcel = binPackingService.packItems(request.items);

    // 3. Insurance & Guarantee settings
    const declaredValue = request.insuranceRequested
      ? request.declaredValue || request.cartSubtotal || 0
      : 0;

    const insuranceFee =
      declaredValue > 100
        ? Math.round(
            Math.ceil((declaredValue - 100) / 100) * settings.insuranceRatePerHundred * 100
          ) / 100
        : 0;

    const deliveryGuaranteeFee = request.deliveryGuaranteeRequested
      ? settings.deliveryGuaranteeFee
      : 0;

    // 4. Fetch Base Carrier Rates
    const provider = CarrierFactory.getProvider();
    const rawRates = await provider.getRates({
      from: fromAddress,
      to: toAddress,
      parcel,
      insuranceValue: declaredValue,
      deliveryGuaranteeRequested: request.deliveryGuaranteeRequested,
    });

    // 5. Evaluate Discounts for each rate
    let maxSavings = 0;
    let appliedRule: string | undefined = undefined;
    let appliedPromo: string | undefined = undefined;

    const adjustedRates: CarrierRate[] = rawRates.map((rate) => {
      // Calculate shipping discount (applies to shipping base rate)
      const discountEval = discountService.evaluateDiscount({
        cartSubtotal: request.cartSubtotal,
        originalShippingRate: rate.baseRate,
        promoCode: request.promoCode,
      });

      const discountAmount = discountEval.discountAmount;
      if (discountAmount > maxSavings) {
        maxSavings = discountAmount;
        appliedRule = discountEval.ruleApplied;
        appliedPromo = discountEval.promoCode;
      }

      // Final customer rate = (baseRate - discountAmount) + insuranceFee + deliveryGuaranteeFee
      const netBase = Math.max(0, rate.baseRate - discountAmount);
      const totalRate = Math.round((netBase + rate.insuranceFee + rate.deliveryGuaranteeFee) * 100) / 100;

      return {
        ...rate,
        discountAmount,
        finalCustomerRate: totalRate,
      };
    });

    // Sort by final customer rate
    adjustedRates.sort((a, b) => a.finalCustomerRate - b.finalCustomerRate);

    // Identify cheapest and fastest
    let cheapestRateId = adjustedRates[0]?.id || '';
    let fastest = adjustedRates[0];

    for (const r of adjustedRates) {
      if (r.estimatedDays < (fastest?.estimatedDays || 999)) {
        fastest = r;
      }
    }
    const fastestRateId = fastest?.id || cheapestRateId;

    // Reassign badges
    if (adjustedRates.length > 0) {
      adjustedRates[0].badge = 'Cheapest';
      if (fastest && fastest.id !== adjustedRates[0].id) {
        fastest.badge = 'Fastest';
      }
    }

    const quoteId = `quote_${Date.now()}_${uuidv4().substring(0, 8)}`;

    const response: RateQuoteResponse = {
      quoteId,
      createdAt: new Date().toISOString(),
      origin: fromAddress,
      destination: toAddress,
      parcel,
      rates: adjustedRates,
      cheapestRateId,
      fastestRateId,
      insurance: {
        requested: !!request.insuranceRequested,
        declaredValue,
        fee: insuranceFee,
      },
      deliveryGuarantee: {
        requested: !!request.deliveryGuaranteeRequested,
        fee: deliveryGuaranteeFee,
      },
      discount: {
        applied: maxSavings > 0,
        rule: appliedRule,
        promoCode: appliedPromo,
        savings: maxSavings,
      },
    };

    // Cache quote in DB for later reference/fulfillment
    db.saveQuote(response);

    return response;
  }
}

export const rateCalculationService = new RateCalculationService();
