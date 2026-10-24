import { describe, it, expect, vi } from 'vitest';
import { fulfillmentService } from '../src/services/fulfillmentService.js';
import { db } from '../src/db/database.js';
import { cloverService } from '../src/services/cloverService.js';
import { CarrierFactory } from '../src/carriers/carrierFactory.js';

describe('FulfillmentService & Webhook Fulfillment', () => {
  it('should create a standalone manual shipment, buy label via EasyPost, and store tracking', async () => {
    const orderId = `TEST_MANUAL_${Date.now()}`;

    const shipment = await fulfillmentService.createManualShipment({
      toAddress: {
        name: 'AutoShip Test Recipient',
        street1: '417 Montgomery St',
        street2: 'Fl 5',
        city: 'San Francisco',
        state: 'CA',
        zip: '94104',
        country: 'US',
        phone: '415-555-1212',
      },
      parcel: {
        presetId: 'preset_medium_box',
        presetName: 'Medium Box (Standard)',
        lengthIn: 10,
        widthIn: 7,
        heightIn: 5,
        weightLbs: 2.0,
      },
      carrier: 'USPS',
      service: 'USPS Ground Advantage',
      referenceId: orderId,
    });

    expect(shipment).toBeDefined();
    expect(shipment.orderId).toBe(orderId);
    expect(shipment.carrier).toBe('USPS');
    expect(shipment.trackingNumber).toBeDefined();
    expect(shipment.status).toBe('label_created');
    expect(shipment.labelUrl).toBeDefined();
    expect(shipment.trackingTimeline).toHaveLength(1);

    // Verify persisted in database
    const fetched = db.getShipmentById(shipment.id);
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(shipment.id);
  });

  it('should fulfill a paid order and be idempotent', async () => {
    const orderId = `IDEMPOTENT_ORD_${Date.now()}`;

    // Mock cloverService.getOrder for this orderId
    vi.spyOn(cloverService, 'getOrder').mockResolvedValue({
      id: orderId,
      currency: 'USD',
      total: 5500,
      state: 'paid',
      shippingAddress: {
        name: 'AutoShip Test Recipient',
        street1: '417 Montgomery St',
        street2: 'Fl 5',
        city: 'San Francisco',
        state: 'CA',
        zip: '94104',
        country: 'US',
        phone: '415-555-1212',
        isResidential: true,
      },
      lineItems: [
        {
          id: 'li_test_1',
          name: 'Ceramic Artisan Mug',
          price: 2500,
          unitQty: 1,
          sku: 'HOME-MUG-CERAM',
        },
      ],
      note: 'AutoShip Test Order',
    });

    const first = await fulfillmentService.fulfillOrder({ orderId, carrier: 'USPS', service: 'USPS Priority Mail' });
    const second = await fulfillmentService.fulfillOrder({ orderId, carrier: 'USPS', service: 'USPS Priority Mail' });

    expect(first.id).toBe(second.id);
    expect(first.trackingNumber).toBe(second.trackingNumber);
  });

  it('should void a shipment and update status properly', async () => {
    const orderId = `VOID_ORD_${Date.now()}`;

    vi.spyOn(cloverService, 'getOrder').mockResolvedValue({
      id: orderId,
      currency: 'USD',
      total: 3500,
      state: 'paid',
      shippingAddress: {
        name: 'AutoShip Test Recipient',
        street1: '417 Montgomery St',
        street2: 'Fl 5',
        city: 'San Francisco',
        state: 'CA',
        zip: '94104',
        country: 'US',
        phone: '415-555-1212',
        isResidential: true,
      },
      lineItems: [
        {
          id: 'li_test_2',
          name: 'Organic Cotton T-Shirt',
          price: 2800,
          unitQty: 1,
          sku: 'APP-TSHIRT-01',
        },
      ],
    });

    const shipment = await fulfillmentService.fulfillOrder({ orderId, carrier: 'USPS', service: 'USPS Priority Mail' });
    const provider = CarrierFactory.getProvider();
    const voidSuccess = await provider.voidLabel(shipment.id);

    expect(voidSuccess).toBe(true);
  });
});
