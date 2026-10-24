import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { printerService, PRINTER_PRESETS } from '../services/printerService.js';
import { ThermalPrintFormat, ReceiptPaperWidth } from '../types/index.js';

export class PrinterController {
  /**
   * POST /api/printers/print-label
   * Dispatches a print job (ZPL or ESC/POS) over raw TCP socket to the specified printer
   */
  public static async printLabel(req: Request, res: Response): Promise<void> {
    try {
      const { shipmentId, printerIp, printerPort, format, paperWidth, copies } = req.body;

      if (!shipmentId) {
        res.status(400).json({ success: false, error: 'shipmentId is required' });
        return;
      }

      const shipment = db.getShipmentById(shipmentId);
      if (!shipment) {
        res.status(404).json({ success: false, error: `Shipment "${shipmentId}" not found` });
        return;
      }

      const settings = db.getSettings();
      const targetIp = printerIp || settings.defaultPrinterIp;
      if (!targetIp) {
        res.status(400).json({
          success: false,
          error: 'printerIp is required. Please provide a printer IP or configure a default printer in settings.',
        });
        return;
      }

      const targetPort = printerPort ? Number(printerPort) : settings.defaultPrinterPort || 9100;
      if (isNaN(targetPort) || targetPort <= 0 || targetPort > 65535) {
        res.status(400).json({ success: false, error: 'printerPort must be a valid port number between 1 and 65535' });
        return;
      }

      const printFormat: ThermalPrintFormat = (format || settings.defaultPrinterFormat || 'ZPL') as ThermalPrintFormat;
      if (printFormat !== 'ZPL' && printFormat !== 'ESCPOS') {
        res.status(400).json({ success: false, error: 'format must be either "ZPL" or "ESCPOS"' });
        return;
      }

      const receiptWidth: ReceiptPaperWidth = (paperWidth || '80mm') as ReceiptPaperWidth;
      if (receiptWidth !== '80mm' && receiptWidth !== '58mm') {
        res.status(400).json({ success: false, error: 'paperWidth must be either "80mm" or "58mm"' });
        return;
      }

      const jobResult = await printerService.printShipment(shipmentId, {
        printerIp: targetIp,
        printerPort: targetPort,
        format: printFormat,
        paperWidth: receiptWidth,
        copies: copies ? Number(copies) : 1,
      });

      res.status(200).json({
        success: true,
        message: `Successfully printed shipping label to ${targetIp}:${targetPort}`,
        data: jobResult,
      });
    } catch (err: any) {
      console.error('[PrinterController] printLabel error:', err);
      res.status(502).json({
        success: false,
        error: err.message || 'Failed to dispatch print job to thermal printer',
      });
    }
  }

  /**
   * POST /api/printers/test
   * Tests TCP socket connection to a thermal printer IP on port 9100
   */
  public static async testPrinter(req: Request, res: Response): Promise<void> {
    try {
      const { printerIp, printerPort, timeoutMs } = req.body;

      if (!printerIp) {
        res.status(400).json({ success: false, error: 'printerIp is required' });
        return;
      }

      const targetPort = printerPort ? Number(printerPort) : 9100;
      if (isNaN(targetPort) || targetPort <= 0 || targetPort > 65535) {
        res.status(400).json({ success: false, error: 'printerPort must be between 1 and 65535' });
        return;
      }

      const testResult = await printerService.testPrinterConnection(
        printerIp,
        targetPort,
        timeoutMs ? Number(timeoutMs) : 3000
      );

      if (testResult.success) {
        res.status(200).json({
          success: true,
          message: `Successfully connected to thermal printer at ${printerIp}:${targetPort} (${testResult.latencyMs}ms)`,
          data: testResult,
        });
      } else {
        res.status(200).json({
          success: false,
          message: `Unable to reach thermal printer at ${printerIp}:${targetPort}: ${testResult.error}`,
          data: testResult,
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/printers/preview/:shipmentId
   * Previews ZPL code or ESC/POS slip for a given shipment
   */
  public static async previewLabel(req: Request, res: Response): Promise<void> {
    try {
      const { shipmentId } = req.params;
      const { format = 'ZPL', paperWidth = '80mm' } = req.query;

      const shipment = db.getShipmentById(shipmentId);
      if (!shipment) {
        res.status(404).json({ success: false, error: `Shipment "${shipmentId}" not found` });
        return;
      }

      if (format === 'ESCPOS') {
        const width = (paperWidth === '58mm' ? '58mm' : '80mm') as ReceiptPaperWidth;
        const escposBuffer = printerService.generateEscPos(shipment, { width });
        const receiptText = printerService.generateReceiptText(shipment, width);

        res.status(200).json({
          success: true,
          shipmentId,
          format: 'ESCPOS',
          paperWidth: width,
          receiptText,
          byteLength: escposBuffer.length,
          rawBase64: escposBuffer.toString('base64'),
        });
        return;
      }

      // Default: ZPL
      const zpl = printerService.generateZpl(shipment);
      res.status(200).json({
        success: true,
        shipmentId,
        format: 'ZPL',
        zpl,
        byteLength: Buffer.byteLength(zpl, 'utf-8'),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/printers/presets
   * Returns list of known commercial thermal printer presets
   */
  public static async getPresets(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      count: PRINTER_PRESETS.length,
      data: PRINTER_PRESETS,
    });
  }
}
