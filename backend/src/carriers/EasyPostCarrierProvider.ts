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

export class EasyPostCarrierProvider implements ICarrierProvider {
  public name = 'EasyPostCarrierProvider';
  private apiKey: string;
  private baseUrl = 'https://api.easypost.com/v2';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.EASYPOST_API_KEY || db.getSettings().easyPostApiKey || '';
  }

  private getActiveApiKey(): string {
    return this.apiKey || process.env.EASYPOST_API_KEY || db.getSettings().easyPostApiKey || '';
  }

  private getAuthHeader(): string {
    const key = this.getActiveApiKey();
    return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
  }

  private mapCarrierName(carrierStr: string): CarrierCode {
    const lower = carrierStr.toLowerCase();
    if (lower.includes('fedex')) return 'FedEx';
    if (lower.includes('ups')) return 'UPS';
    return 'USPS';
  }

  /**
   * Fetch real rates from EasyPost REST API
   */
  public async getRates(params: GetRatesParams): Promise<CarrierRate[]> {
    const key = this.getActiveApiKey();

    if (!key) {
      throw new Error(
        'EasyPost API Key is not configured. Please enter your API key in Carrier Settings.'
      );
    }

    const { from, to, parcel, insuranceValue, deliveryGuaranteeRequested } = params;
    const settings = db.getSettings();

    const payload = {
      shipment: {
        to_address: {
          name: to.name,
          street1: to.street1,
          street2: to.street2,
          city: to.city,
          state: to.state,
          zip: to.zip,
          country: to.country || 'US',
          phone: to.phone,
          email: to.email,
        },
        from_address: {
          name: from.name,
          company: from.company,
          street1: from.street1,
          street2: from.street2,
          city: from.city,
          state: from.state,
          zip: from.zip,
          country: from.country || 'US',
          phone: from.phone,
        },
        parcel: {
          length: parcel.lengthIn,
          width: parcel.widthIn,
          height: parcel.heightIn,
          weight: parcel.totalWeightOz,
        },
      },
    };

    const response = await fetch(`${this.baseUrl}/shipments`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let msg = errorText;
      try {
        const parsed = JSON.parse(errorText);
        msg = parsed.error?.message || errorText;
      } catch (_) {}
      throw new Error(`EasyPost rating error (${response.status}): ${msg}`);
    }

    const data = (await response.json()) as any;
    const rawRates = data.rates || [];

    let insuranceFee = 0;
    if (insuranceValue && insuranceValue > 100) {
      insuranceFee =
        Math.round(Math.ceil((insuranceValue - 100) / 100) * settings.insuranceRatePerHundred * 100) /
        100;
    }
    const guaranteeFee = deliveryGuaranteeRequested ? settings.deliveryGuaranteeFee : 0;

    const rates: CarrierRate[] = rawRates.map((r: any) => {
      const carrier = this.mapCarrierName(r.carrier);
      const baseRate = parseFloat(r.rate);
      const estimatedDays = r.delivery_days || 3;

      const date = new Date();
      date.setDate(date.getDate() + estimatedDays);

      return {
        id: r.id,
        carrier,
        service: r.service,
        serviceCode: r.service.toLowerCase().replace(/\s+/g, '_'),
        description: `${carrier} ${r.service}`,
        baseRate,
        insuranceFee,
        deliveryGuaranteeFee: r.delivery_date_guaranteed ? 0 : guaranteeFee,
        discountAmount: 0,
        finalCustomerRate:
          Math.round(
            (baseRate + insuranceFee + (r.delivery_date_guaranteed ? 0 : guaranteeFee)) * 100
          ) / 100,
        estimatedDays,
        estimatedDeliveryDate: r.delivery_date
          ? r.delivery_date.split('T')[0]
          : date.toISOString().split('T')[0],
        guaranteedDelivery: !!r.delivery_date_guaranteed,
      };
    });

    // Filter by merchant-enabled carriers
    const filtered = rates.filter((r) => settings.enabledCarriers[r.carrier]);
    filtered.sort((a, b) => a.finalCustomerRate - b.finalCustomerRate);

    if (filtered.length > 0) {
      filtered[0].badge = 'Cheapest';
    }

    return filtered;
  }

  /**
   * Buy label through EasyPost REST API
   */
  public async buyLabel(params: BuyLabelParams): Promise<Shipment> {
    const key = this.getActiveApiKey();

    if (!key) {
      throw new Error('EasyPost API Key is not configured. Please enter your API key in Settings.');
    }

    const { from, to, parcel, carrier, service, orderId, cloverOrderId, insuranceValue } = params;

    // 1. Create EasyPost Shipment
    const createPayload = {
      shipment: {
        to_address: {
          name: to.name,
          street1: to.street1,
          street2: to.street2,
          city: to.city,
          state: to.state,
          zip: to.zip,
          country: to.country || 'US',
          phone: to.phone,
          email: to.email,
        },
        from_address: {
          name: from.name,
          company: from.company,
          street1: from.street1,
          street2: from.street2,
          city: from.city,
          state: from.state,
          zip: from.zip,
          country: from.country || 'US',
          phone: from.phone,
        },
        parcel: {
          length: parcel.lengthIn,
          width: parcel.widthIn,
          height: parcel.heightIn,
          weight: parcel.totalWeightOz,
        },
      },
    };

    const createRes = await fetch(`${this.baseUrl}/shipments`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createPayload),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      let msg = errorText;
      try {
        const parsed = JSON.parse(errorText);
        msg = parsed.error?.message || errorText;
      } catch (_) {}
      throw new Error(`EasyPost shipment creation failed (${createRes.status}): ${msg}`);
    }

    const shpData = (await createRes.json()) as any;
    const rates = shpData.rates || [];

    // Find matching rate or target rateId
    let selectedRate = params.rateId ? rates.find((r: any) => r.id === params.rateId) : undefined;
    if (!selectedRate && rates.length > 0) {
      selectedRate =
        rates.find(
          (r: any) =>
            r.carrier.toLowerCase() === carrier.toLowerCase() &&
            r.service.toLowerCase().includes(service.toLowerCase())
        ) ||
        rates.find((r: any) => r.carrier.toLowerCase() === carrier.toLowerCase()) ||
        rates[0];
    }

    if (!selectedRate) {
      throw new Error(`No matching EasyPost rate found for carrier ${carrier} and service ${service}.`);
    }

    // 2. Buy rate on EasyPost: POST /shipments/{id}/buy
    const buyRes = await fetch(`${this.baseUrl}/shipments/${shpData.id}/buy`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rate: { id: selectedRate.id },
        insurance: insuranceValue && insuranceValue > 0 ? insuranceValue.toString() : undefined,
      }),
    });

    if (!buyRes.ok) {
      const errText = await buyRes.text();
      let msg = errText;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || errText;
      } catch (_) {}
      throw new Error(`EasyPost label purchase failed (${buyRes.status}): ${msg}`);
    }

    const data = (await buyRes.json()) as any;
    const trackingNumber = data.tracking_code;
    const labelUrl = data.postage_label?.label_url || `/api/shipments/${data.id}/label`;
    const shippingCost = parseFloat(data.selected_rate?.rate || selectedRate.rate || '0');

    const shipment: Shipment = {
      id: data.id,
      orderId,
      cloverOrderId,
      carrier,
      service: selectedRate.service || service,
      serviceCode: (selectedRate.service || service).toLowerCase().replace(/\s+/g, '_'),
      trackingNumber,
      trackingUrl:
        data.tracker?.public_url ||
        `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      labelUrl,
      labelFormat: 'PNG',
      labelData: `<img src="${labelUrl}" alt="Carrier Shipping Label" style="max-width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" />`,
      status: 'label_created',
      statusDetails: 'Shipping label purchased via EasyPost',
      fromAddress: from,
      toAddress: to,
      parcel,
      shippingCost,
      insuranceCost: 0,
      totalCost: shippingCost,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      trackingTimeline: [
        {
          timestamp: new Date().toISOString(),
          status: 'label_created',
          statusDetails: 'Label purchased via EasyPost',
          location: `${from.city}, ${from.state}`,
        },
      ],
    };

    db.saveShipment(shipment);
    return shipment;
  }

  public async getTracking(trackingCode: string, carrier: CarrierCode): Promise<TrackingEvent[]> {
    const key = this.getActiveApiKey();
    if (!key) {
      throw new Error('EasyPost API Key is not configured.');
    }
    const res = await fetch(`${this.baseUrl}/trackers?tracking_code=${encodeURIComponent(trackingCode)}`, {
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as any;
    const tracker = data.trackers?.[0];
    if (!tracker || !tracker.tracking_details) {
      return [];
    }
    return tracker.tracking_details.map((d: any) => ({
      timestamp: d.datetime,
      status: d.status,
      statusDetails: d.message,
      location: d.tracking_location ? `${d.tracking_location.city || ''}, ${d.tracking_location.state || ''}`.trim() : '',
    }));
  }

  public async voidLabel(shipmentId: string): Promise<boolean> {
    const key = this.getActiveApiKey();
    if (!key) {
      throw new Error('EasyPost API Key is not configured.');
    }
    const res = await fetch(`${this.baseUrl}/shipments/${shipmentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });
    return res.ok;
  }
}

export const easyPostCarrierProvider = new EasyPostCarrierProvider();
