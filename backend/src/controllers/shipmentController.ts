import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { fulfillmentService } from '../services/fulfillmentService.js';
import { CarrierFactory } from '../carriers/carrierFactory.js';
import { ShipmentStatus } from '../types/index.js';

export class ShipmentController {
  public static async getShipments(req: Request, res: Response): Promise<void> {
    try {
      const { status, carrier, search } = req.query;
      let shipments = db.getShipments();

      if (status) {
        shipments = shipments.filter((s) => s.status === status);
      }
      if (carrier) {
        shipments = shipments.filter(
          (s) => s.carrier.toLowerCase() === (carrier as string).toLowerCase()
        );
      }
      if (search) {
        const query = (search as string).toLowerCase();
        shipments = shipments.filter(
          (s) =>
            s.orderId.toLowerCase().includes(query) ||
            s.trackingNumber.toLowerCase().includes(query) ||
            s.toAddress.name.toLowerCase().includes(query)
        );
      }

      res.status(200).json({
        success: true,
        count: shipments.length,
        data: shipments,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getShipmentById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const shipment = db.getShipmentById(id);

      if (!shipment) {
        res.status(404).json({ success: false, error: 'Shipment not found' });
        return;
      }

      res.status(200).json({ success: true, data: shipment });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getLabel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { format, view } = req.query;
      const shipment = db.getShipmentById(id);

      if (!shipment) {
        res.status(404).json({ success: false, error: 'Shipment not found' });
        return;
      }

      // If client requests raw SVG
      if (format === 'svg' || req.headers.accept?.includes('image/svg+xml')) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(shipment.labelData || '');
        return;
      }

      // If client wants a print-ready HTML page (standard for browser printing)
      if (view === 'print' || format === 'html') {
        res.setHeader('Content-Type', 'text/html');
        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Print Label - ${shipment.trackingNumber}</title>
  <style>
    @page {
      size: 4in 6in;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #f0f0f0;
      font-family: sans-serif;
    }
    .label-container {
      width: 4in;
      height: 6in;
      background: #fff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      position: relative;
    }
    @media print {
      body { background: transparent; }
      .label-container { box-shadow: none; }
      .no-print { display: none !important; }
    }
    .print-bar {
      position: fixed;
      top: 15px;
      right: 15px;
      background: #228800;
      color: #fff;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      border: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
  </style>
</head>
<body>
  <button class="print-bar no-print" onclick="window.print()">🖨️ Print Label</button>
  <div class="label-container">
    ${shipment.labelData}
  </div>
</body>
</html>
        `);
        return;
      }

      // Default JSON payload
      res.status(200).json({
        success: true,
        data: {
          shipmentId: shipment.id,
          orderId: shipment.orderId,
          trackingNumber: shipment.trackingNumber,
          labelUrl: shipment.labelUrl,
          printUrl: `/api/shipments/${shipment.id}/label?view=print`,
          labelFormat: shipment.labelFormat,
          svgData: shipment.labelData,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async fulfill(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, carrier, service, insuranceRequested } = req.body;
      if (!orderId) {
        res.status(400).json({ success: false, error: 'orderId is required' });
        return;
      }

      const shipment = await fulfillmentService.fulfillOrder({
        orderId,
        carrier,
        service,
        insuranceRequested,
      });

      res.status(201).json({
        success: true,
        message: 'Shipping label created successfully',
        data: shipment,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Standalone flow: create a shipping label from scratch without an active Clover Register order
   */
  public static async createManual(req: Request, res: Response): Promise<void> {
    try {
      const {
        toAddress,
        fromAddress,
        parcel,
        carrier,
        service,
        referenceId,
        insuranceRequested,
        declaredValue,
      } = req.body;

      if (!toAddress || !toAddress.name || !toAddress.street1 || !toAddress.city || !toAddress.state || !toAddress.zip) {
        res.status(400).json({
          success: false,
          error: 'Recipient address (name, street1, city, state, zip) is required',
        });
        return;
      }

      if (!parcel || !parcel.weightLbs || parcel.weightLbs <= 0) {
        res.status(400).json({ success: false, error: 'Valid package weight is required' });
        return;
      }

      if (!carrier || !service) {
        res.status(400).json({ success: false, error: 'Carrier and service are required' });
        return;
      }

      const shipment = await fulfillmentService.createManualShipment({
        toAddress,
        fromAddress,
        parcel,
        carrier,
        service,
        referenceId,
        insuranceRequested: !!insuranceRequested,
        declaredValue: declaredValue || 0,
      });

      res.status(201).json({
        success: true,
        message: `Shipping label successfully created with tracking ${shipment.trackingNumber}`,
        data: shipment,
      });
    } catch (err: any) {
      console.error('Error creating manual shipment:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async addTrackingEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, statusDetails, location } = req.body;

      const shipment = db.getShipmentById(id);
      if (!shipment) {
        res.status(404).json({ success: false, error: 'Shipment not found' });
        return;
      }

      const newStatus = (status as ShipmentStatus) || 'in_transit';
      shipment.status = newStatus;
      shipment.statusDetails = statusDetails || `Status updated to ${newStatus}`;
      shipment.updatedAt = new Date().toISOString();

      shipment.trackingTimeline.push({
        timestamp: new Date().toISOString(),
        status: newStatus,
        statusDetails: shipment.statusDetails,
        location: location || `${shipment.toAddress.city}, ${shipment.toAddress.state}`,
      });

      db.saveShipment(shipment);

      res.status(200).json({
        success: true,
        data: shipment,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async voidShipment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const provider = CarrierFactory.getProvider();
      const success = await provider.voidLabel(id);

      if (!success) {
        res.status(404).json({ success: false, error: 'Shipment not found or could not be voided' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Shipment voided and postage refund submitted successfully',
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}
