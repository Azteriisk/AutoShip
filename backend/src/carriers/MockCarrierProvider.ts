import {
  Address,
  CarrierCode,
  CarrierRate,
  PackedPackage,
  Shipment,
  TrackingEvent,
} from '../types/index.js';
import { GetRatesParams, BuyLabelParams, ICarrierProvider } from './ICarrierProvider.js';
import { db } from '../db/database.js';

export class MockCarrierProvider implements ICarrierProvider {
  public name = 'MockCarrierProvider';

  /**
   * Estimates postal shipping zone (1-8) based on origin & destination ZIP codes
   */
  private calculateZone(fromZip: string, toZip: string): number {
    const fromPrefix = parseInt(fromZip.substring(0, 1), 10) || 7;
    const toPrefix = parseInt(toZip.substring(0, 1), 10) || 7;
    const diff = Math.abs(fromPrefix - toPrefix);

    if (diff === 0) return 2; // Local / regional
    if (diff <= 2) return 4;
    if (diff <= 4) return 6;
    return 8; // Cross-country
  }

  /**
   * Calculates delivery date skipping Saturday/Sunday
   */
  private calculateDeliveryDate(businessDays: number): string {
    const date = new Date();
    let added = 0;
    while (added < businessDays) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        added++;
      }
    }
    return date.toISOString().split('T')[0];
  }

  /**
   * Generates realistic multi-carrier rates
   */
  public async getRates(params: GetRatesParams): Promise<CarrierRate[]> {
    const { from, to, parcel, insuranceValue, deliveryGuaranteeRequested } = params;
    const settings = db.getSettings();
    const zone = this.calculateZone(from.zip || '78701', to.zip || '90210');
    const billableWeight = parcel.billableWeightLbs || 1.0;

    // Insurance calculation
    let insuranceFee = 0;
    if (insuranceValue && insuranceValue > 100) {
      const excessHundred = Math.ceil((insuranceValue - 100) / 100);
      insuranceFee = Math.round(excessHundred * settings.insuranceRatePerHundred * 100) / 100;
    }

    // Delivery guarantee fee
    const guaranteeFee = deliveryGuaranteeRequested ? settings.deliveryGuaranteeFee : 0;

    const rates: CarrierRate[] = [];

    // 1. USPS Options
    if (settings.enabledCarriers.USPS) {
      // USPS Ground Advantage
      const uspsGroundBase = 4.5 + billableWeight * 1.35 + zone * 0.42;
      const uspsGroundDays = Math.min(5, Math.max(2, Math.floor(zone / 2) + 2));
      rates.push({
        id: `rate_usps_ground_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        carrier: 'USPS',
        service: 'USPS Ground Advantage',
        serviceCode: 'usps_ground_advantage',
        description: 'Reliable, cost-effective standard delivery in 2-5 business days',
        baseRate: Math.round(uspsGroundBase * 100) / 100,
        insuranceFee,
        deliveryGuaranteeFee: guaranteeFee,
        discountAmount: 0,
        finalCustomerRate: Math.round((uspsGroundBase + insuranceFee + guaranteeFee) * 100) / 100,
        estimatedDays: uspsGroundDays,
        estimatedDeliveryDate: this.calculateDeliveryDate(uspsGroundDays),
        guaranteedDelivery: false,
      });

      // USPS Priority Mail
      const uspsPriorityBase = 8.2 + billableWeight * 1.85 + zone * 0.6;
      const uspsPriorityDays = Math.min(3, Math.max(1, Math.floor(zone / 3) + 1));
      rates.push({
        id: `rate_usps_priority_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        carrier: 'USPS',
        service: 'USPS Priority Mail',
        serviceCode: 'usps_priority_mail',
        description: 'Fast 1-3 business day delivery with $100 included USPS insurance',
        baseRate: Math.round(uspsPriorityBase * 100) / 100,
        insuranceFee,
        deliveryGuaranteeFee: guaranteeFee,
        discountAmount: 0,
        finalCustomerRate: Math.round((uspsPriorityBase + insuranceFee + guaranteeFee) * 100) / 100,
        estimatedDays: uspsPriorityDays,
        estimatedDeliveryDate: this.calculateDeliveryDate(uspsPriorityDays),
        guaranteedDelivery: false,
      });

      // USPS Priority Mail Express
      const uspsExpressBase = 27.5 + billableWeight * 3.1 + zone * 1.15;
      rates.push({
        id: `rate_usps_express_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        carrier: 'USPS',
        service: 'USPS Priority Mail Express',
        serviceCode: 'usps_priority_mail_express',
        description: 'Next-day to 2-day delivery with money-back guarantee',
        baseRate: Math.round(uspsExpressBase * 100) / 100,
        insuranceFee,
        deliveryGuaranteeFee: 0, // already guaranteed
        discountAmount: 0,
        finalCustomerRate: Math.round((uspsExpressBase + insuranceFee) * 100) / 100,
        estimatedDays: 1,
        estimatedDeliveryDate: this.calculateDeliveryDate(1),
        guaranteedDelivery: true,
      });
    }

    // 2. UPS Options
    if (settings.enabledCarriers.UPS) {
      // UPS Ground
      const upsGroundBase = 9.1 + billableWeight * 1.6 + zone * 0.52;
      const upsGroundDays = Math.min(5, Math.max(1, Math.floor(zone / 2) + 1));
      rates.push({
        id: `rate_ups_ground_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        carrier: 'UPS',
        service: 'UPS Ground',
        serviceCode: 'ups_ground',
        description: 'Dependable day-definite ground delivery',
        baseRate: Math.round(upsGroundBase * 100) / 100,
        insuranceFee,
        deliveryGuaranteeFee: guaranteeFee,
        discountAmount: 0,
        finalCustomerRate: Math.round((upsGroundBase + insuranceFee + guaranteeFee) * 100) / 100,
        estimatedDays: upsGroundDays,
        estimatedDeliveryDate: this.calculateDeliveryDate(upsGroundDays),
        guaranteedDelivery: true,
      });

      // UPS 2nd Day Air
      const ups2DayBase = 21.0 + billableWeight * 2.8 + zone * 1.2;
      rates.push({
        id: `rate_ups_2day_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        carrier: 'UPS',
        service: 'UPS 2nd Day Air',
        serviceCode: 'ups_2nd_day_air',
        description: 'Guaranteed 2-business day delivery throughout the US',
        baseRate: Math.round(ups2DayBase * 100) / 100,
        insuranceFee,
        deliveryGuaranteeFee: 0,
        discountAmount: 0,
        finalCustomerRate: Math.round((ups2DayBase + insuranceFee) * 100) / 100,
        estimatedDays: 2,
        estimatedDeliveryDate: this.calculateDeliveryDate(2),
        guaranteedDelivery: true,
      });

      // UPS Next Day Air
      const upsNextDayBase = 37.0 + billableWeight * 4.0 + zone * 1.75;
      rates.push({
        id: `rate_ups_next_day_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        carrier: 'UPS',
        service: 'UPS Next Day Air',
        serviceCode: 'ups_next_day_air',
        description: 'Guaranteed next business day overnight delivery',
        baseRate: Math.round(upsNextDayBase * 100) / 100,
        insuranceFee,
        deliveryGuaranteeFee: 0,
        discountAmount: 0,
        finalCustomerRate: Math.round((upsNextDayBase + insuranceFee) * 100) / 100,
        estimatedDays: 1,
        estimatedDeliveryDate: this.calculateDeliveryDate(1),
        guaranteedDelivery: true,
      });
    }

    // 3. FedEx Options
    if (settings.enabledCarriers.FedEx) {
      // FedEx Home Delivery
      const fedexHomeBase = 9.3 + billableWeight * 1.55 + zone * 0.58;
      const fedexDays = Math.min(5, Math.max(1, Math.floor(zone / 2) + 1));
      rates.push({
        id: `rate_fedex_home_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        carrier: 'FedEx',
        service: 'FedEx Home Delivery',
        serviceCode: 'fedex_home_delivery',
        description: 'Every day residential delivery including weekends',
        baseRate: Math.round(fedexHomeBase * 100) / 100,
        insuranceFee,
        deliveryGuaranteeFee: guaranteeFee,
        discountAmount: 0,
        finalCustomerRate: Math.round((fedexHomeBase + insuranceFee + guaranteeFee) * 100) / 100,
        estimatedDays: fedexDays,
        estimatedDeliveryDate: this.calculateDeliveryDate(fedexDays),
        guaranteedDelivery: false,
      });

      // FedEx 2Day
      const fedex2DayBase = 20.5 + billableWeight * 2.75 + zone * 1.2;
      rates.push({
        id: `rate_fedex_2day_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        carrier: 'FedEx',
        service: 'FedEx 2Day',
        serviceCode: 'fedex_2day',
        description: 'Second-business-day delivery by 4:30 p.m. to most areas',
        baseRate: Math.round(fedex2DayBase * 100) / 100,
        insuranceFee,
        deliveryGuaranteeFee: 0,
        discountAmount: 0,
        finalCustomerRate: Math.round((fedex2DayBase + insuranceFee) * 100) / 100,
        estimatedDays: 2,
        estimatedDeliveryDate: this.calculateDeliveryDate(2),
        guaranteedDelivery: true,
      });

      // FedEx Standard Overnight
      const fedexOvernightBase = 38.5 + billableWeight * 4.15 + zone * 1.85;
      rates.push({
        id: `rate_fedex_overnight_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        carrier: 'FedEx',
        service: 'FedEx Standard Overnight',
        serviceCode: 'fedex_standard_overnight',
        description: 'Next-business-day afternoon delivery',
        baseRate: Math.round(fedexOvernightBase * 100) / 100,
        insuranceFee,
        deliveryGuaranteeFee: 0,
        discountAmount: 0,
        finalCustomerRate: Math.round((fedexOvernightBase + insuranceFee) * 100) / 100,
        estimatedDays: 1,
        estimatedDeliveryDate: this.calculateDeliveryDate(1),
        guaranteedDelivery: true,
      });
    }

    // Sort by finalCustomerRate
    rates.sort((a, b) => a.finalCustomerRate - b.finalCustomerRate);

    // Assign badges
    if (rates.length > 0) {
      rates[0].badge = 'Cheapest';

      let fastest = rates[0];
      for (const r of rates) {
        if (r.estimatedDays < fastest.estimatedDays) {
          fastest = r;
        }
      }
      if (fastest && fastest !== rates[0]) {
        fastest.badge = 'Fastest';
      }

      // Best value: middle tier or priority
      const priority = rates.find((r) => r.service.includes('Priority Mail') || r.service.includes('Ground'));
      if (priority && !priority.badge) {
        priority.badge = 'Best Value';
      }
    }

    return rates;
  }

  /**
   * Generates a unique carrier tracking number
   */
  private generateTrackingNumber(carrier: CarrierCode): string {
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    switch (carrier) {
      case 'USPS':
        return `9400111899562${randomDigits.substring(0, 9)}`;
      case 'UPS':
        return `1Z999AA101${randomDigits.substring(0, 8)}`;
      case 'FedEx':
        return `7892${randomDigits.substring(0, 8)}`;
    }
  }

  /**
   * Generates an authentic SVG shipping label (4x6 aspect ratio)
   */
  public generateSvgLabel(params: {
    shipmentId: string;
    carrier: CarrierCode;
    service: string;
    trackingNumber: string;
    from: Address;
    to: Address;
    parcel: PackedPackage;
    dateStr: string;
  }): string {
    const { shipmentId, carrier, service, trackingNumber, from, to, parcel, dateStr } = params;

    // Generate pseudo barcode bars for Code 128
    const barcodeBars: string[] = [];
    let curX = 30;
    const barWidths = [2, 4, 1, 3, 2, 5, 2, 1, 4, 3, 1, 2, 4, 2, 3, 1, 5, 2, 1, 3, 4, 2, 3, 1, 2];
    for (let i = 0; i < 60; i++) {
      const w = barWidths[i % barWidths.length];
      barcodeBars.push(`<rect x="${curX}" y="420" width="${w}" height="75" fill="#000" />`);
      curX += w + 2 + ((i * 3) % 4);
      if (curX > 370) break;
    }

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="100%" height="100%" style="font-family: Arial, Helvetica, sans-serif; background: #fff; border: 2px solid #222;">
  <!-- Header Bar -->
  <rect x="0" y="0" width="400" height="60" fill="#111" />
  <text x="20" y="38" fill="#fff" font-size="22" font-weight="bold">${carrier}</text>
  <text x="380" y="38" fill="#fff" font-size="14" font-weight="bold" text-anchor="end">${service.toUpperCase()}</text>

  <!-- Indicia / Postage Box -->
  <rect x="270" y="70" width="115" height="55" fill="none" stroke="#000" stroke-width="1.5" />
  <text x="327" y="86" font-size="9" font-weight="bold" text-anchor="middle">U.S. POSTAGE PAID</text>
  <text x="327" y="99" font-size="9" text-anchor="middle">${carrier} e-Postage</text>
  <text x="327" y="112" font-size="8" text-anchor="middle">Permit No. G-10</text>
  <text x="327" y="122" font-size="8" text-anchor="middle">${dateStr}</text>

  <!-- Ship From Address -->
  <g transform="translate(20, 75)">
    <text x="0" y="0" font-size="9" font-weight="bold" fill="#666">SHIP FROM:</text>
    <text x="0" y="14" font-size="11" font-weight="bold">${from.company || from.name}</text>
    <text x="0" y="27" font-size="10">${from.street1}</text>
    ${from.street2 ? `<text x="0" y="40" font-size="10">${from.street2}</text>` : ''}
    <text x="0" y="${from.street2 ? 53 : 40}" font-size="10">${from.city}, ${from.state} ${from.zip}</text>
  </g>

  <!-- Divider Line -->
  <line x1="20" y1="140" x2="380" y2="140" stroke="#000" stroke-width="2" />

  <!-- Ship To Address (Large) -->
  <g transform="translate(30, 165)">
    <text x="0" y="0" font-size="11" font-weight="bold" fill="#444">SHIP TO:</text>
    <text x="0" y="22" font-size="16" font-weight="bold">${to.name.toUpperCase()}</text>
    ${to.company ? `<text x="0" y="38" font-size="12">${to.company}</text>` : ''}
    <text x="0" y="${to.company ? 54 : 40}" font-size="14">${to.street1.toUpperCase()}</text>
    ${to.street2 ? `<text x="0" y="${to.company ? 70 : 56}" font-size="14">${to.street2.toUpperCase()}</text>` : ''}
    <text x="0" y="${to.street2 ? (to.company ? 88 : 74) : (to.company ? 72 : 58)}" font-size="16" font-weight="bold">
      ${to.city.toUpperCase()} ${to.state.toUpperCase()} ${to.zip}
    </text>
  </g>

  <!-- Package & Weight Details -->
  <line x1="20" y1="275" x2="380" y2="275" stroke="#000" stroke-width="1.5" />
  <g transform="translate(25, 295)">
    <text x="0" y="0" font-size="11" font-weight="bold">PKG: <tspan font-weight="normal">${parcel.presetName}</tspan></text>
    <text x="170" y="0" font-size="11" font-weight="bold">WT: <tspan font-weight="normal">${parcel.totalWeightLbs} LBS (${parcel.totalWeightOz} oz)</tspan></text>
    <text x="0" y="18" font-size="10" fill="#555">DIM: ${parcel.lengthIn}" x ${parcel.widthIn}" x ${parcel.heightIn}"</text>
    <text x="170" y="18" font-size="10" fill="#555">BILLABLE: ${parcel.billableWeightLbs} LBS</text>
  </g>

  <!-- Large Postal Routing Code / Zone Banner -->
  <rect x="20" y="330" width="360" height="45" fill="#f0f0f0" stroke="#000" stroke-width="1" />
  <text x="35" y="358" font-size="18" font-weight="bold" letter-spacing="3">${to.zip.substring(0, 5)} - C022</text>
  <text x="365" y="358" font-size="14" font-weight="bold" text-anchor="end">eVS</text>

  <!-- Barcode Section -->
  <text x="200" y="405" font-size="11" font-weight="bold" text-anchor="middle">${carrier.toUpperCase()} TRACKING #</text>
  
  <!-- Render Barcode Pattern -->
  <g id="barcode">
    ${barcodeBars.join('\n    ')}
  </g>

  <!-- Tracking Number Text -->
  <text x="200" y="515" font-size="14" font-weight="bold" letter-spacing="2" text-anchor="middle">
    ${trackingNumber}
  </text>

  <!-- Footer with AutoShip details -->
  <line x1="20" y1="540" x2="380" y2="540" stroke="#888" stroke-width="1" stroke-dasharray="4,2" />
  <text x="20" y="565" font-size="9" fill="#777">AutoShip for Clover POS | Shipment: ${shipmentId}</text>
  <text x="380" y="565" font-size="9" fill="#777" text-anchor="end">Commercial Base Pricing</text>
</svg>
    `.trim();
  }

  /**
   * Purchases a shipping label and creates a shipment record
   */
  public async buyLabel(params: BuyLabelParams): Promise<Shipment> {
    const {
      from,
      to,
      parcel,
      carrier,
      service,
      serviceCode = 'standard',
      insuranceValue = 0,
      orderId,
      cloverOrderId,
    } = params;

    const shipmentId = `shp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const trackingNumber = this.generateTrackingNumber(carrier);
    const dateStr = new Date().toISOString().split('T')[0];

    // Calculate simulated cost
    const rates = await this.getRates({
      from,
      to,
      parcel,
      insuranceValue,
    });

    const matchingRate =
      rates.find((r) => r.service.toLowerCase() === service.toLowerCase() && r.carrier === carrier) ||
      rates[0];

    const shippingCost = matchingRate ? matchingRate.baseRate : 8.5;
    const insuranceCost = matchingRate ? matchingRate.insuranceFee : 0;
    const totalCost = shippingCost + insuranceCost;

    const svgData = this.generateSvgLabel({
      shipmentId,
      carrier,
      service,
      trackingNumber,
      from,
      to,
      parcel,
      dateStr,
    });

    const initialTrackingEvent: TrackingEvent = {
      timestamp: new Date().toISOString(),
      status: 'label_created',
      statusDetails: 'Shipping label created. Awaiting carrier pickup.',
      location: `${from.city}, ${from.state}`,
    };

    const trackingUrl =
      carrier === 'USPS'
        ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`
        : carrier === 'UPS'
        ? `https://www.ups.com/track?tracknum=${trackingNumber}`
        : `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;

    const shipment: Shipment = {
      id: shipmentId,
      orderId,
      cloverOrderId,
      carrier,
      service,
      serviceCode,
      trackingNumber,
      trackingUrl,
      labelUrl: `/api/shipments/${shipmentId}/label`,
      labelFormat: 'SVG',
      labelData: svgData,
      status: 'label_created',
      statusDetails: 'Shipping label generated and ready for printing',
      fromAddress: from,
      toAddress: to,
      parcel,
      shippingCost,
      insuranceCost,
      totalCost,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      trackingTimeline: [initialTrackingEvent],
    };

    db.saveShipment(shipment);
    return shipment;
  }

  /**
   * Retrieves tracking history
   */
  public async getTracking(trackingCode: string, carrier: CarrierCode): Promise<TrackingEvent[]> {
    const shipment = db.getShipmentById(trackingCode);
    if (shipment && shipment.trackingTimeline.length > 0) {
      return shipment.trackingTimeline;
    }

    return [
      {
        timestamp: new Date().toISOString(),
        status: 'in_transit',
        statusDetails: 'Package is in transit to the destination hub',
        location: 'Regional Sorting Facility',
      },
    ];
  }

  /**
   * Voids an existing shipping label
   */
  public async voidLabel(shipmentId: string): Promise<boolean> {
    const shipment = db.getShipmentById(shipmentId);
    if (!shipment) return false;

    if (shipment.status === 'in_transit' || shipment.status === 'delivered') {
      throw new Error(`Cannot void shipment in "${shipment.status}" status`);
    }

    shipment.status = 'voided';
    shipment.statusDetails = 'Postage refunded / shipment voided';
    shipment.updatedAt = new Date().toISOString();
    shipment.trackingTimeline.push({
      timestamp: new Date().toISOString(),
      status: 'voided',
      statusDetails: 'Shipping label voided by merchant. Refund requested.',
      location: 'Merchant Origin',
    });

    db.saveShipment(shipment);
    return true;
  }
}

export const mockCarrierProvider = new MockCarrierProvider();
