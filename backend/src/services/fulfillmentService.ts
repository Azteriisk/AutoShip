import { Shipment, Item, CarrierCode, Address, PackedPackage } from '../types/index.js';
import { db } from '../db/database.js';
import { cloverService } from './cloverService.js';
import { binPackingService } from './binPackingService.js';
import { CarrierFactory } from '../carriers/carrierFactory.js';
import { cloverBillingService } from './billingService.js';

export interface FulfillOrderParams {
  orderId: string;
  carrier?: CarrierCode;
  service?: string;
  insuranceRequested?: boolean;
}

export interface CreateManualShipmentParams {
  toAddress: Address;
  fromAddress?: Address;
  parcel: {
    presetId?: string;
    presetName?: string;
    lengthIn: number;
    widthIn: number;
    heightIn: number;
    weightLbs: number;
  };
  carrier: CarrierCode;
  service: string;
  referenceId?: string;
  insuranceRequested?: boolean;
  declaredValue?: number;
}

export class FulfillmentService {
  /**
   * Automatically fulfills an order upon payment: packs items, buys postage, and creates shipment
   */
  public async fulfillOrder(params: FulfillOrderParams): Promise<Shipment> {
    const { orderId } = params;
    const settings = db.getSettings();

    // 1. Idempotency check: see if shipment already exists
    const existing = db.getShipmentByOrderId(orderId);
    if (existing && existing.status !== 'voided') {
      return existing;
    }

    // 2. Retrieve Clover Order details
    const cloverOrder = await cloverService.getOrder(orderId);

    // 3. Resolve destination address
    const toAddress = cloverOrder.shippingAddress;
    if (!toAddress || !toAddress.street1 || !toAddress.zip) {
      throw new Error(
        `Clover Order #${orderId} does not have a destination shipping address attached. Please specify recipient shipping details before fulfilling.`
      );
    }

    // 4. Map Clover line items to catalog items for dimensions/weight
    const items: Item[] = [];
    if (cloverOrder.lineItems && cloverOrder.lineItems.length > 0) {
      for (const li of cloverOrder.lineItems) {
        // Skip shipping line items
        if (li.name.toLowerCase().startsWith('shipping:')) continue;

        const catalogItem = li.sku ? db.getCatalogItem(li.sku) : undefined;
        const qty = li.unitQty || 1;
        const price = (li.price || 0) / 100;

        if (catalogItem) {
          items.push({
            ...catalogItem,
            quantity: qty,
            price,
          });
        } else {
          items.push({
            id: li.id,
            sku: li.sku || 'GENERIC-ITEM',
            name: li.name,
            quantity: qty,
            price,
            weightOz: 12.0,
            lengthIn: 8.0,
            widthIn: 6.0,
            heightIn: 2.0,
          });
        }
      }
    }

    if (items.length === 0) {
      throw new Error(`Clover Order #${orderId} has no merchandise line items to package and ship.`);
    }

    // 5. Pack items into appropriate box
    const parcel = binPackingService.packItems(items);

    // 6. Select Carrier & Service Level
    const carrier = params.carrier || settings.defaultCarrier || 'USPS';
    const service = params.service || settings.defaultService || 'USPS Ground Advantage';

    // 7. Calculate insurance
    const declaredValue = params.insuranceRequested ? cloverOrder.total / 100 : 0;

    // 8. Buy shipping label
    const provider = CarrierFactory.getProvider();
    const shipment = await provider.buyLabel({
      orderId,
      cloverOrderId: cloverOrder.id,
      from: settings.originAddress,
      to: toAddress,
      parcel,
      carrier,
      service,
      insuranceValue: declaredValue,
    });

    // 9. Sync tracking info back to Clover
    await cloverService.updateOrderTracking(
      cloverOrder.id,
      shipment.trackingNumber,
      shipment.carrier,
      shipment.trackingUrl
    );

    // 10. Record Metered Usage to Clover Billing based on merchant plan tier
    try {
      await cloverBillingService.processShipmentBilling(settings.merchantId || 'MERCHANT_CLOVER_12345');
    } catch (billingErr) {
      console.error('[AutoShip Billing] Error recording metered billing event:', billingErr);
    }

    return shipment;
  }

  /**
   * Creates a standalone shipping label from scratch without an auto-linked Clover Register transaction
   */
  public async createManualShipment(params: CreateManualShipmentParams): Promise<Shipment> {
    const settings = db.getSettings();
    const from = params.fromAddress || settings.originAddress;
    const to = params.toAddress;

    const weightOz = Math.round(params.parcel.weightLbs * 16 * 10) / 10;
    const packedPackage: PackedPackage = {
      presetId: params.parcel.presetId || 'preset_custom',
      presetName: params.parcel.presetName || 'Custom Package',
      lengthIn: params.parcel.lengthIn,
      widthIn: params.parcel.widthIn,
      heightIn: params.parcel.heightIn,
      itemWeightOz: weightOz,
      tareWeightOz: 0,
      totalWeightOz: weightOz,
      totalWeightLbs: params.parcel.weightLbs,
      billableWeightLbs: params.parcel.weightLbs,
      itemsPacked: [
        {
          id: 'manual_goods',
          name: params.referenceId ? `Manual Shipment (${params.referenceId})` : 'Merchant Parcel',
          quantity: 1,
        },
      ],
      packingEfficiencyPercent: 100,
    };

    const orderId = params.referenceId?.trim() || `MANUAL_${Date.now().toString().slice(-6)}`;
    const declaredValue = params.insuranceRequested ? (params.declaredValue || 0) : 0;

    const provider = CarrierFactory.getProvider();
    const shipment = await provider.buyLabel({
      orderId,
      from,
      to,
      parcel: packedPackage,
      carrier: params.carrier,
      service: params.service,
      insuranceValue: declaredValue,
    });

    // Record Metered Usage to Clover Billing based on merchant plan tier
    try {
      await cloverBillingService.processShipmentBilling(settings.merchantId || 'MERCHANT_CLOVER_12345');
    } catch (billingErr) {
      console.error('[AutoShip Billing] Error recording metered billing event for manual shipment:', billingErr);
    }

    return shipment;
  }
}

export const fulfillmentService = new FulfillmentService();
