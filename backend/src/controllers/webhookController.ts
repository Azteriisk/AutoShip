import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { cloverService } from '../services/cloverService.js';
import { fulfillmentService } from '../services/fulfillmentService.js';
import { ShipmentStatus } from '../types/index.js';

export class WebhookController {
  /**
   * Handles incoming Clover webhook notifications (orders.updated, payments.created)
   */
  public static async handleCloverWebhook(req: Request, res: Response): Promise<void> {
    const authHeader =
      (req.headers['x-clover-auth'] as string | undefined) ||
      (req.headers['x-clover-signature'] as string | undefined) ||
      (req.headers['x-signature'] as string | undefined);
    const body = req.body;

    // Handle Clover URL verification handshake
    if (body && body.verificationCode) {
      console.log(`\n========================================`);
      console.log(`[CLOVER WEBHOOK VERIFICATION CODE]: ${body.verificationCode}`);
      console.log(`========================================\n`);
      db.logWebhook('clover_verification_code', { code: body.verificationCode }, 'success');
      res.status(200).json({ success: true, verificationCode: body.verificationCode });
      return;
    }

    // Extract raw payload for cryptographic HMAC-SHA256 verification
    const rawPayload =
      (req as any).rawBody !== undefined
        ? (req as any).rawBody
        : typeof body === 'string'
        ? body
        : JSON.stringify(body);

    // Verify webhook signature
    if (!cloverService.verifyWebhookSignature(authHeader, rawPayload)) {
      console.warn('Unauthorized Clover Webhook request received');
      res.status(401).json({ success: false, error: 'Unauthorized webhook signature' });
      return;
    }

    // Immediately respond 200 OK to Clover so the webhook doesn't timeout
    res.status(200).json({ success: true, message: 'Webhook received' });

    // Process asynchronously
    try {
      db.logWebhook('clover_webhook_received', body, 'processing');

      // 1. Check Clover official nested structure
      if (body.merchants) {
        for (const merchantId of Object.keys(body.merchants)) {
          const events = body.merchants[merchantId] || [];
          for (const ev of events) {
            let orderId: string | null = null;

            if (ev.type === 'orders') {
              orderId = ev.objectId.replace(/^O:/, '');
            } else if (ev.type === 'payments') {
              // Fetch payment to find associated orderId, or strip P: prefix
              orderId = ev.objectId.replace(/^P:/, '');
            } else if (ev.type === 'app') {
              // Subscription plan change or install event
              const planId = ev.objectId;
              if (planId.includes('YC22908RFMB50')) {
                db.updateSettings({ planTier: 'growth' });
              } else if (planId.includes('GPYEA178Y1NDC')) {
                db.updateSettings({ planTier: 'pay_as_you_go' });
              } else if (planId.includes('W9AMRPTJFDM8T')) {
                db.updateSettings({ planTier: 'enterprise' });
              }
              db.logWebhook(`clover_app_subscription_updated:${merchantId}`, { planId, ev }, 'success');
            }

            if (orderId) {
              const order = await cloverService.getOrder(orderId);
              if (order && (order.state === 'paid' || ev.action === 'UPDATE')) {
                const shipment = await fulfillmentService.fulfillOrder({ orderId });
                db.logWebhook(
                  `clover_order_fulfilled:${orderId}`,
                  { orderId, shipmentId: shipment.id, trackingNumber: shipment.trackingNumber },
                  'success'
                );
              }
            }
          }
        }
      }
      // 2. Direct / simplified test format
      else if (body.orderId) {
        const orderId = body.orderId;
        const shipment = await fulfillmentService.fulfillOrder({
          orderId,
          carrier: body.carrier,
          service: body.service,
        });

        db.logWebhook(
          `manual_order_fulfilled:${orderId}`,
          { orderId, shipmentId: shipment.id, trackingNumber: shipment.trackingNumber },
          'success'
        );
      }
    } catch (err: any) {
      console.error('Error processing Clover webhook:', err);
      db.logWebhook('clover_webhook_error', body, 'error', err.message);
    }
  }

  /**
   * Handles incoming EasyPost webhook notifications (e.g. tracker.updated)
   */
  public static async handleEasyPostWebhook(req: Request, res: Response): Promise<void> {
    const body = req.body;
    // Immediately respond 200 OK to EasyPost
    res.status(200).json({ success: true, message: 'EasyPost webhook received' });

    try {
      db.logWebhook('easypost_webhook_received', body, 'processing');
      const tracker = body?.result;

      if (tracker && tracker.tracking_code) {
        const trackingNumber = tracker.tracking_code;
        const status = tracker.status;
        const statusDetail = tracker.status_detail || '';
        const location = tracker.tracking_location
          ? `${tracker.tracking_location.city || ''}, ${tracker.tracking_location.state || ''}`.trim()
          : undefined;

        const shipment = db.getShipmentById(trackingNumber);
        if (shipment) {
          const mappedStatus: ShipmentStatus =
            status === 'delivered'
              ? 'delivered'
              : status === 'out_for_delivery'
              ? 'out_for_delivery'
              : status === 'in_transit'
              ? 'in_transit'
              : status === 'return_to_sender' || status === 'failure'
              ? 'voided'
              : 'in_transit';

          shipment.status = mappedStatus;
          shipment.statusDetails = statusDetail || `Status updated to ${mappedStatus}`;
          shipment.updatedAt = new Date().toISOString();
          shipment.trackingTimeline.push({
            timestamp: new Date().toISOString(),
            status: mappedStatus,
            statusDetails: shipment.statusDetails,
            location: location || `${shipment.toAddress.city}, ${shipment.toAddress.state}`,
          });

          db.saveShipment(shipment);
          db.logWebhook(
            `easypost_tracker_updated:${trackingNumber}`,
            { shipmentId: shipment.id, trackingNumber, status: mappedStatus },
            'success'
          );
        }
      }
    } catch (err: any) {
      console.error('Error processing EasyPost webhook:', err);
      db.logWebhook('easypost_webhook_error', body, 'error', err.message);
    }
  }

  /**
   * Endpoint to simulate a Clover Webhook for testing from the Merchant Dashboard
   */
  public static async simulateWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { orderId = 'CLOVER_ORD_88219', carrier, service } = req.body;

      const order = await cloverService.getOrder(orderId);
      const shipment = await fulfillmentService.fulfillOrder({
        orderId: order.id,
        carrier,
        service,
      });

      db.logWebhook(
        `simulated_webhook:${order.id}`,
        { orderId: order.id, shipmentId: shipment.id, trackingNumber: shipment.trackingNumber },
        'success'
      );

      res.status(200).json({
        success: true,
        message: `Simulated Clover webhook processed. Shipping label generated for Order #${order.id}`,
        shipment,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Returns recent webhook logs
   */
  public static async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const logs = db.getWebhookLogs();
      res.status(200).json({ success: true, count: logs.length, data: logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
