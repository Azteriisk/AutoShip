import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import net from 'net';
import { printerService, PRINTER_PRESETS, EscPosBuilder } from '../src/services/printerService.js';
import { PrinterController } from '../src/controllers/printerController.js';
import { db } from '../src/db/database.js';
import { Shipment } from '../src/types/index.js';

describe('Thermal Printing Engine (ZPL, ESC/POS, Network TCP Socket)', () => {
  const sampleShipment: Shipment = {
    id: 'shp_test_thermal_123',
    orderId: 'ORD_TEST_9988',
    cloverOrderId: 'CLV_TEST_4433',
    carrier: 'USPS',
    service: 'USPS Priority Mail',
    serviceCode: 'usps_priority_mail',
    trackingNumber: '9400111899562123456789',
    trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899562123456789',
    labelUrl: '/api/shipments/shp_test_thermal_123/label',
    labelFormat: 'SVG',
    labelData: '<svg>mock</svg>',
    status: 'label_created',
    statusDetails: 'Shipping label created. Ready for thermal print.',
    fromAddress: {
      name: 'AutoShip Fulfillment Hub',
      company: 'AutoShip Boutique',
      street1: '123 Commerce Blvd',
      street2: 'Suite 400',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      country: 'US',
    },
    toAddress: {
      name: 'Jane Doe',
      company: 'Tech Horizons Inc',
      street1: '417 Montgomery St',
      street2: 'Fl 5',
      city: 'San Francisco',
      state: 'CA',
      zip: '94104',
      country: 'US',
    },
    parcel: {
      presetId: 'preset_medium_box',
      presetName: 'Medium Box (Standard)',
      lengthIn: 10,
      widthIn: 7,
      heightIn: 5,
      itemWeightOz: 28,
      tareWeightOz: 4,
      totalWeightOz: 32,
      totalWeightLbs: 2.0,
      billableWeightLbs: 2.0,
      itemsPacked: [
        { id: 'item_1', name: 'Ceramic Artisan Mug', quantity: 2 },
        { id: 'item_2', name: 'Organic Cotton T-Shirt', quantity: 1 },
      ],
      packingEfficiencyPercent: 82,
    },
    shippingCost: 8.5,
    insuranceCost: 0,
    totalCost: 8.5,
    createdAt: '2026-10-24T12:00:00.000Z',
    updatedAt: '2026-10-24T12:00:00.000Z',
    trackingTimeline: [],
  };

  beforeEach(() => {
    db.saveShipment(sampleShipment);
  });

  // ==========================================
  // 1. ZPL GENERATOR TESTS
  // ==========================================
  describe('ZPL Generator (4"x6" standard 203 DPI)', () => {
    it('generates valid ZPL II format with standard dimensions and delimiters', () => {
      const zpl = printerService.generateZpl(sampleShipment);

      // Label boundaries
      expect(zpl.startsWith('^XA')).toBe(true);
      expect(zpl.endsWith('^XZ')).toBe(true);

      // Label dimensions: 4"x6" @ 203 DPI -> 812 dots wide, 1218 dots tall
      expect(zpl).toContain('^PW812');
      expect(zpl).toContain('^LL1218');
      expect(zpl).toContain('^CI28'); // UTF-8 encoding
    });

    it('contains carrier header, postage indicia, and ship from/to blocks', () => {
      const zpl = printerService.generateZpl(sampleShipment);

      // Carrier & Service
      expect(zpl).toContain('^FDUSPS^FS');
      expect(zpl).toContain('USPS PRIORITY MAIL');

      // Postage Indicia
      expect(zpl).toContain('U.S. POSTAGE PAID');
      expect(zpl).toContain('USPS e-Postage');
      expect(zpl).toContain('Permit No. G-10');

      // Origin
      expect(zpl).toContain('AutoShip Boutique');
      expect(zpl).toContain('123 Commerce Blvd');
      expect(zpl).toContain('Austin, TX 78701');

      // Recipient
      expect(zpl).toContain('JANE DOE');
      expect(zpl).toContain('TECH HORIZONS INC');
      expect(zpl).toContain('417 MONTGOMERY ST');
      expect(zpl).toContain('FL 5');
      expect(zpl).toContain('SAN FRANCISCO CA 94104');
    });

    it('contains package dimensions, weight, and postal routing bar', () => {
      const zpl = printerService.generateZpl(sampleShipment);

      expect(zpl).toContain('PKG: Medium Box (Standard)');
      expect(zpl).toContain('WT: 2.00 LBS (32.0 oz)');
      expect(zpl).toContain('DIM: 10" x 7" x 5"');
      expect(zpl).toContain('BILLABLE: 2.00 LBS');
      expect(zpl).toContain('ZIP 94104 - C022');
      expect(zpl).toContain('eVS');
    });

    it('contains Code 128 barcode and human-readable formatted tracking number', () => {
      const zpl = printerService.generateZpl(sampleShipment);

      // Code 128 barcode
      expect(zpl).toContain('^BCN,140,N,N,N');
      expect(zpl).toContain(`^FD>:${sampleShipment.trackingNumber}^FS`);

      // Human readable tracking formatted in groups
      expect(zpl).toContain('9400 1118 9956 2123 4567 89');
    });

    it('sanitizes special ZPL characters (^, ~) to prevent injection', () => {
      const injectionShipment: Shipment = {
        ...sampleShipment,
        orderId: 'ORD^XZ^XA_INJECT',
        toAddress: {
          ...sampleShipment.toAddress,
          name: 'Jane ~DN Doe ^FDHACK',
        },
      };

      const zpl = printerService.generateZpl(injectionShipment);

      // Must not contain injected ^XZ inside the field data
      expect(zpl).not.toContain('^XZ^XA_INJECT');
      expect(zpl).not.toContain('~DN');
      expect(zpl).toContain('JANE  DN DOE  FDHACK');
    });
  });

  // ==========================================
  // 2. ESC/POS RECEIPT PACKING SLIP TESTS
  // ==========================================
  describe('ESC/POS & Clover Packing Slip Generator', () => {
    it('generates valid 80mm ESC/POS binary buffer with init, barcode, and cut commands', () => {
      const buffer = printerService.generateEscPos(sampleShipment, { width: '80mm' });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(100);

      // ESC @ (0x1B, 0x40) - Initialize printer
      expect(buffer[0]).toBe(0x1b);
      expect(buffer[1]).toBe(0x40);

      // Contains ESC/POS Code 128 command sequence: GS k 73 (0x1D, 0x6B, 73)
      let foundBarcode = false;
      for (let i = 0; i < buffer.length - 3; i++) {
        if (buffer[i] === 0x1d && buffer[i + 1] === 0x6b && buffer[i + 2] === 73) {
          foundBarcode = true;
          break;
        }
      }
      expect(foundBarcode).toBe(true);

      // Ends with cut command: GS V (0x1D, 0x56)
      const last10 = buffer.subarray(buffer.length - 10);
      let foundCut = false;
      for (let i = 0; i < last10.length - 1; i++) {
        if (last10[i] === 0x1d && last10[i + 1] === 0x56) {
          foundCut = true;
          break;
        }
      }
      expect(foundCut).toBe(true);
    });

    it('generates 58mm compact receipt buffer for mobile/mini Clover printers', () => {
      const buffer58 = printerService.generateEscPos(sampleShipment, { width: '58mm' });
      expect(Buffer.isBuffer(buffer58)).toBe(true);
      expect(buffer58.length).toBeGreaterThan(50);
    });

    it('generates plain text receipt matching shipment and line items', () => {
      const text80 = printerService.generateReceiptText(sampleShipment, '80mm');

      expect(text80).toContain('PROOF OF SHIPPING / PACKING SLIP');
      expect(text80).toContain('ORD_TEST_9988');
      expect(text80).toContain('CLV_TEST_4433');
      expect(text80).toContain('USPS');
      expect(text80).toContain('JANE DOE');
      expect(text80).toContain('417 MONTGOMERY ST');
      expect(text80).toContain('Ceramic Artisan Mug');
      expect(text80).toContain('2x');
      expect(text80).toContain('Organic Cotton T-Shirt');
      expect(text80).toContain('1x');
      expect(text80).toContain('9400 1118 9956 2123 4567 89');
    });

    it('formats plain text receipt cleanly for 58mm width without exceeding 32 columns', () => {
      const text58 = printerService.generateReceiptText(sampleShipment, '58mm');
      const lines = text58.split('\n');

      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(32);
      }
    });

    it('EscPosBuilder builds chaining commands and custom formatting', () => {
      const builder = new EscPosBuilder();
      const buf = builder
        .init()
        .align('center')
        .bold(true)
        .line('TITLE')
        .divider('=', 32)
        .twoColumn('Left', 'Right', 32)
        .cut(true)
        .toBuffer();

      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.toString('utf-8')).toContain('TITLE');
      expect(buf.toString('utf-8')).toContain('================================');
      expect(buf.toString('utf-8')).toContain('Left');
      expect(buf.toString('utf-8')).toContain('Right');
    });
  });

  // ==========================================
  // 3. TRACKING NUMBER FORMATTER TESTS
  // ==========================================
  describe('Tracking Number Formatter', () => {
    it('formats 22-digit USPS tracking numbers into 6 groups', () => {
      const formatted = printerService.formatTrackingNumber('9400111899562123456789');
      expect(formatted).toBe('9400 1118 9956 2123 4567 89');
    });

    it('formats 18-digit UPS tracking numbers into standard groups', () => {
      const formatted = printerService.formatTrackingNumber('1Z999AA10123456784');
      expect(formatted).toBe('1Z 999 AA1 01 2345 6784');
    });

    it('formats 12-digit FedEx tracking numbers into 3 groups', () => {
      const formatted = printerService.formatTrackingNumber('789212345678');
      expect(formatted).toBe('7892 1234 5678');
    });
  });

  // ==========================================
  // 4. NETWORK SOCKET TCP DISPATCHER TESTS
  // ==========================================
  describe('Network Socket TCP Dispatcher (Port 9100)', () => {
    let mockServer: net.Server;
    let serverPort: number;
    let receivedData: Buffer[] = [];
    let endCallback: (() => void) | null = null;

    const waitForServerEnd = (): Promise<void> => {
      return new Promise((resolve) => {
        endCallback = resolve;
      });
    };

    beforeEach(async () => {
      receivedData = [];
      endCallback = null;
      await new Promise<void>((resolve) => {
        mockServer = net.createServer((socket) => {
          socket.on('data', (chunk) => {
            receivedData.push(chunk);
          });
          socket.on('end', () => {
            if (endCallback) {
              const cb = endCallback;
              endCallback = null;
              cb();
            }
          });
        });
        mockServer.listen(0, '127.0.0.1', () => {
          const address = mockServer.address() as net.AddressInfo;
          serverPort = address.port;
          resolve();
        });
      });
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
      });
    });

    it('tests printer TCP socket connection successfully and measures latency', async () => {
      const testResult = await printerService.testPrinterConnection('127.0.0.1', serverPort, 2000);

      expect(testResult.success).toBe(true);
      expect(testResult.ip).toBe('127.0.0.1');
      expect(testResult.port).toBe(serverPort);
      expect(typeof testResult.latencyMs).toBe('number');
      expect(testResult.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('handles connection failures gracefully on unavailable ports without crashing', async () => {
      // Pick a random closed port
      const testResult = await printerService.testPrinterConnection('127.0.0.1', 65530, 1000);

      expect(testResult.success).toBe(false);
      expect(testResult.error).toBeDefined();
    });

    it('dispatches raw ZPL string payload over TCP socket and receives full buffer', async () => {
      const zplPayload = printerService.generateZpl(sampleShipment);

      const serverEndPromise = waitForServerEnd();
      const result = await printerService.sendRawSocket('127.0.0.1', serverPort, zplPayload);
      await serverEndPromise;

      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBe(Buffer.byteLength(zplPayload, 'utf-8'));

      // Verify server received exact payload
      const combined = Buffer.concat(receivedData).toString('utf-8');
      expect(combined).toBe(zplPayload);
    });

    it('dispatches raw ESC/POS binary buffer payload over TCP socket', async () => {
      const escposPayload = printerService.generateEscPos(sampleShipment);

      const serverEndPromise = waitForServerEnd();
      const result = await printerService.sendRawSocket('127.0.0.1', serverPort, escposPayload);
      await serverEndPromise;

      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBe(escposPayload.length);

      const combined = Buffer.concat(receivedData);
      expect(combined).toEqual(escposPayload);
    });

    it('prints a shipment in ZPL format and returns structured job result', async () => {
      const serverEndPromise = waitForServerEnd();
      const jobResult = await printerService.printShipment(sampleShipment.id, {
        printerIp: '127.0.0.1',
        printerPort: serverPort,
        format: 'ZPL',
      });
      await serverEndPromise;

      expect(jobResult.success).toBe(true);
      expect(jobResult.jobId).toMatch(/^job_/);
      expect(jobResult.shipmentId).toBe(sampleShipment.id);
      expect(jobResult.format).toBe('ZPL');
      expect(jobResult.bytesSent).toBeGreaterThan(200);

      const received = Buffer.concat(receivedData).toString('utf-8');
      expect(received).toContain('^XA');
      expect(received).toContain(sampleShipment.trackingNumber);
    });

    it('prints a shipment in ESC/POS format with 2 copies', async () => {
      const serverEndPromise = waitForServerEnd();
      const jobResult = await printerService.printShipment(sampleShipment.id, {
        printerIp: '127.0.0.1',
        printerPort: serverPort,
        format: 'ESCPOS',
        paperWidth: '80mm',
        copies: 2,
      });
      await serverEndPromise;

      expect(jobResult.success).toBe(true);
      expect(jobResult.format).toBe('ESCPOS');
      expect(jobResult.bytesSent).toBeGreaterThan(100);

      const received = Buffer.concat(receivedData);
      expect(received.length).toBe(jobResult.bytesSent);
    });

    it('throws error when shipment does not exist', async () => {
      await expect(
        printerService.printShipment('non_existent_shipment_id', {
          printerIp: '127.0.0.1',
          printerPort: serverPort,
        })
      ).rejects.toThrow('Shipment "non_existent_shipment_id" not found');
    });

    it('throws error when printerIp is missing and not configured in settings', async () => {
      db.updateSettings({ defaultPrinterIp: undefined });
      await expect(
        printerService.printShipment(sampleShipment.id, {
          printerIp: '',
        })
      ).rejects.toThrow('Printer IP is required');
    });
  });

  // ==========================================
  // 5. PRINTER CONTROLLER ENDPOINTS
  // ==========================================
  describe('PrinterController Endpoints', () => {
    let mockServer: net.Server;
    let serverPort: number;

    beforeEach(async () => {
      await new Promise<void>((resolve) => {
        mockServer = net.createServer((socket) => {
          socket.on('data', () => {});
        });
        mockServer.listen(0, '127.0.0.1', () => {
          const address = mockServer.address() as net.AddressInfo;
          serverPort = address.port;
          resolve();
        });
      });
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
      });
    });

    const createMockRes = () => {
      const res: any = {};
      res.statusCode = 200;
      res.body = null;
      res.status = vi.fn().mockImplementation((code: number) => {
        res.statusCode = code;
        return res;
      });
      res.json = vi.fn().mockImplementation((data: any) => {
        res.body = data;
        return res;
      });
      return res;
    };

    it('POST /api/printers/test succeeds on active printer IP and port', async () => {
      const req: any = {
        body: {
          printerIp: '127.0.0.1',
          printerPort: serverPort,
        },
      };
      const res = createMockRes();

      await PrinterController.testPrinter(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.latencyMs).toBeDefined();
    });

    it('POST /api/printers/test returns 400 when printerIp is missing', async () => {
      const req: any = { body: {} };
      const res = createMockRes();

      await PrinterController.testPrinter(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('printerIp is required');
    });

    it('POST /api/printers/print-label prints ZPL label successfully', async () => {
      const req: any = {
        body: {
          shipmentId: sampleShipment.id,
          printerIp: '127.0.0.1',
          printerPort: serverPort,
          format: 'ZPL',
        },
      };
      const res = createMockRes();

      await PrinterController.printLabel(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shipmentId).toBe(sampleShipment.id);
      expect(res.body.data.format).toBe('ZPL');
    });

    it('POST /api/printers/print-label prints ESC/POS packing slip successfully', async () => {
      const req: any = {
        body: {
          shipmentId: sampleShipment.id,
          printerIp: '127.0.0.1',
          printerPort: serverPort,
          format: 'ESCPOS',
          paperWidth: '80mm',
        },
      };
      const res = createMockRes();

      await PrinterController.printLabel(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.format).toBe('ESCPOS');
    });

    it('POST /api/printers/print-label returns 404 for non-existent shipment', async () => {
      const req: any = {
        body: {
          shipmentId: 'unknown_shipment_999',
          printerIp: '127.0.0.1',
        },
      };
      const res = createMockRes();

      await PrinterController.printLabel(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/printers/print-label returns 400 for invalid format', async () => {
      const req: any = {
        body: {
          shipmentId: sampleShipment.id,
          printerIp: '127.0.0.1',
          format: 'INVALID_FORMAT',
        },
      };
      const res = createMockRes();

      await PrinterController.printLabel(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('format must be either "ZPL" or "ESCPOS"');
    });

    it('GET /api/printers/preview/:shipmentId generates preview data', async () => {
      const reqZpl: any = {
        params: { shipmentId: sampleShipment.id },
        query: { format: 'ZPL' },
      };
      const resZpl = createMockRes();

      await PrinterController.previewLabel(reqZpl, resZpl);
      expect(resZpl.statusCode).toBe(200);
      expect(resZpl.body.format).toBe('ZPL');
      expect(resZpl.body.zpl).toContain('^XA');

      const reqEscpos: any = {
        params: { shipmentId: sampleShipment.id },
        query: { format: 'ESCPOS', paperWidth: '80mm' },
      };
      const resEscpos = createMockRes();

      await PrinterController.previewLabel(reqEscpos, resEscpos);
      expect(resEscpos.statusCode).toBe(200);
      expect(resEscpos.body.format).toBe('ESCPOS');
      expect(resEscpos.body.receiptText).toContain('PROOF OF SHIPPING');
      expect(resEscpos.body.rawBase64).toBeDefined();
    });

    it('GET /api/printers/presets returns standard commercial presets', async () => {
      const req: any = {};
      const res = createMockRes();

      await PrinterController.getPresets(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(PRINTER_PRESETS.length);
      const brands = res.body.data.map((p: any) => p.brand);
      expect(brands).toContain('Zebra');
      expect(brands).toContain('Rollo');
      expect(brands).toContain('Brother');
      expect(brands).toContain('Clover');
    });
  });
});
