import net from 'net';
import { db } from '../db/database.js';
import {
  Shipment,
  ThermalPrintFormat,
  ReceiptPaperWidth,
  PrintJobResult,
  PrinterPreset,
  PrinterTestResult,
} from '../types/index.js';

// ESC/POS Command Byte Constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/**
 * Standard Network Thermal Printer Presets
 */
export const PRINTER_PRESETS: PrinterPreset[] = [
  {
    id: 'zebra_zd420',
    name: 'Zebra ZD420 / GX420d (Network RAW)',
    brand: 'Zebra',
    model: 'ZD420 / GX420d',
    defaultPort: 9100,
    supportedFormats: ['ZPL'],
    defaultDpi: 203,
    paperSizes: ['4x6'],
    description: 'Industry-standard commercial direct thermal label printer using raw ZPL on port 9100',
  },
  {
    id: 'rollo_wireless',
    name: 'Rollo Wireless Thermal Printer',
    brand: 'Rollo',
    model: 'Rollo Wireless',
    defaultPort: 9100,
    supportedFormats: ['ZPL', 'ESCPOS'],
    defaultDpi: 203,
    paperSizes: ['4x6'],
    description: 'High-speed commercial 4x6 thermal printer with WiFi socket support on port 9100',
  },
  {
    id: 'brother_td4550',
    name: 'Brother TD-4550DNWB Thermal Printer',
    brand: 'Brother',
    model: 'TD-4550DNWB',
    defaultPort: 9100,
    supportedFormats: ['ZPL', 'ESCPOS'],
    defaultDpi: 300,
    paperSizes: ['4x6'],
    description: 'Network thermal desktop printer supporting ZPL emulation and raw socket dispatch',
  },
  {
    id: 'dymo_5xl',
    name: 'Dymo LabelWriter 5XL / Network',
    brand: 'Dymo',
    model: 'LabelWriter 5XL',
    defaultPort: 9100,
    supportedFormats: ['ESCPOS', 'ZPL'],
    defaultDpi: 300,
    paperSizes: ['4x6'],
    description: 'Network-attached thermal label printer for wide format shipping labels',
  },
  {
    id: 'clover_station_80mm',
    name: 'Clover Station Built-in Receipt Printer (80mm)',
    brand: 'Clover',
    model: 'Station Receipt Printer',
    defaultPort: 9100,
    supportedFormats: ['ESCPOS'],
    defaultDpi: 203,
    paperSizes: ['80mm'],
    description: 'Clover Station standard 80mm thermal receipt printer for proof-of-shipping packing slips',
  },
  {
    id: 'clover_flex_58mm',
    name: 'Clover Flex / Mini Thermal Printer (58mm)',
    brand: 'Clover',
    model: 'Flex / Mini Printer',
    defaultPort: 9100,
    supportedFormats: ['ESCPOS'],
    defaultDpi: 203,
    paperSizes: ['58mm'],
    description: 'Compact 58mm mobile receipt printer for handheld proof-of-shipping slips',
  },
];

/**
 * EscPosBuilder provides a fluent builder for generating standard ESC/POS binary buffers
 */
export class EscPosBuilder {
  private chunks: Buffer[] = [];

  public init(): this {
    this.chunks.push(Buffer.from([ESC, 0x40])); // ESC @
    return this;
  }

  public align(alignment: 'left' | 'center' | 'right'): this {
    const val = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.chunks.push(Buffer.from([ESC, 0x61, val])); // ESC a n
    return this;
  }

  public bold(enable: boolean = true): this {
    this.chunks.push(Buffer.from([ESC, 0x45, enable ? 1 : 0])); // ESC E n
    return this;
  }

  public doubleSize(enable: boolean = true): this {
    this.chunks.push(Buffer.from([GS, 0x21, enable ? 0x11 : 0x00])); // GS ! n
    return this;
  }

  public doubleHeight(enable: boolean = true): this {
    this.chunks.push(Buffer.from([GS, 0x21, enable ? 0x01 : 0x00]));
    return this;
  }

  public underline(enable: boolean = true): this {
    this.chunks.push(Buffer.from([ESC, 0x2d, enable ? 1 : 0])); // ESC - n
    return this;
  }

  public text(str: string): this {
    this.chunks.push(Buffer.from(str, 'utf-8'));
    return this;
  }

  public line(str: string = ''): this {
    this.chunks.push(Buffer.from(str + '\n', 'utf-8'));
    return this;
  }

  public feed(lines: number = 3): this {
    this.chunks.push(Buffer.from([ESC, 0x64, lines])); // ESC d n
    return this;
  }

  public divider(char: string = '-', totalWidth: number = 48): this {
    const line = char.repeat(Math.max(1, totalWidth));
    return this.line(line);
  }

  public twoColumn(left: string, right: string, totalWidth: number = 48): this {
    const spaceCount = totalWidth - left.length - right.length;
    if (spaceCount <= 0) {
      const truncatedLeft = left.substring(0, Math.max(1, totalWidth - right.length - 1));
      return this.line(truncatedLeft + ' ' + right);
    }
    return this.line(left + ' '.repeat(spaceCount) + right);
  }

  /**
   * Appends Code 128 barcode in ESC/POS format (GS k 73 len data)
   */
  public barcode128(data: string, heightDots: number = 70): this {
    // Set barcode height
    this.chunks.push(Buffer.from([GS, 0x68, heightDots]));
    // Set barcode width (2 dots)
    this.chunks.push(Buffer.from([GS, 0x77, 0x02]));
    // Set HRI position below barcode
    this.chunks.push(Buffer.from([GS, 0x48, 0x02]));

    // Format B: Code 128 (GS k 73)
    // Data must start with subset selection: '{B' for standard ASCII code set B
    const barcodePayload = Buffer.concat([
      Buffer.from([0x7b, 0x42]), // '{B'
      Buffer.from(data, 'ascii'),
    ]);

    const header = Buffer.from([GS, 0x6b, 73, barcodePayload.length]);
    this.chunks.push(Buffer.concat([header, barcodePayload]));
    this.chunks.push(Buffer.from([LF]));
    return this;
  }

  public cut(partial: boolean = true): this {
    // GS V 66 0 (feed and partial cut) or GS V 1
    if (partial) {
      this.chunks.push(Buffer.from([GS, 0x56, 0x01]));
    } else {
      this.chunks.push(Buffer.from([GS, 0x56, 0x00]));
    }
    return this;
  }

  public toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

export class PrinterService {
  /**
   * Sanitizes input strings for ZPL II commands to prevent delimiter injection
   */
  private sanitizeZpl(val: string | undefined | null): string {
    if (!val) return '';
    return val
      .replace(/\^/g, ' ')
      .replace(/~/g, ' ')
      .replace(/\\/g, '/')
      .trim();
  }

  /**
   * Formats a raw carrier tracking number with readable groupings
   */
  public formatTrackingNumber(tracking: string): string {
    const clean = tracking.replace(/\s+/g, '');
    if (clean.length === 22) {
      // USPS 22-digit format: 9400 1118 9956 2123 4567 89
      return clean.replace(/(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{2})/, '$1 $2 $3 $4 $5 $6');
    }
    if (clean.length === 18 && clean.startsWith('1Z')) {
      // UPS 1Z format: 1Z 999 AA1 01 2345 6784
      return clean.replace(/(1Z)(\w{3})(\w{3})(\d{2})(\d{4})(\d{4})/, '$1 $2 $3 $4 $5 $6');
    }
    if (clean.length === 12) {
      // FedEx 12-digit format: 7892 1234 5678
      return clean.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
    }
    // Generic grouping into chunks of 4
    return clean.replace(/(.{4})/g, '$1 ').trim();
  }

  /**
   * Generates standard 4" x 6" Zebra Programming Language (ZPL II) code for a shipment
   * Target: 203 DPI (8 dots/mm) -> 812 dots wide x 1218 dots tall
   */
  public generateZpl(shipment: Shipment): string {
    const from = shipment.fromAddress;
    const to = shipment.toAddress;
    const parcel = shipment.parcel;

    const carrier = this.sanitizeZpl(shipment.carrier);
    const service = this.sanitizeZpl(shipment.service);
    const trackingNum = this.sanitizeZpl(shipment.trackingNumber);
    const formattedTracking = this.formatTrackingNumber(trackingNum);
    const orderId = this.sanitizeZpl(shipment.orderId);
    const cloverOrderId = this.sanitizeZpl(shipment.cloverOrderId || '');
    const dateStr = shipment.createdAt
      ? new Date(shipment.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const fromName = this.sanitizeZpl(from.company || from.name);
    const fromStreet1 = this.sanitizeZpl(from.street1);
    const fromStreet2 = from.street2 ? this.sanitizeZpl(from.street2) : '';
    const fromCityStateZip = this.sanitizeZpl(`${from.city}, ${from.state} ${from.zip}`);

    const toName = this.sanitizeZpl(to.name).toUpperCase();
    const toCompany = to.company ? this.sanitizeZpl(to.company).toUpperCase() : '';
    const toStreet1 = this.sanitizeZpl(to.street1).toUpperCase();
    const toStreet2 = to.street2 ? this.sanitizeZpl(to.street2).toUpperCase() : '';
    const toCityStateZip = this.sanitizeZpl(`${to.city} ${to.state} ${to.zip}`).toUpperCase();

    const presetName = this.sanitizeZpl(parcel.presetName || 'Custom Package');
    const weightLbs = parcel.totalWeightLbs ? parcel.totalWeightLbs.toFixed(2) : '1.00';
    const weightOz = parcel.totalWeightOz ? parcel.totalWeightOz.toFixed(1) : '16.0';
    const billableWeight = parcel.billableWeightLbs ? parcel.billableWeightLbs.toFixed(2) : weightLbs;
    const dimensions = `${parcel.lengthIn}" x ${parcel.widthIn}" x ${parcel.heightIn}"`;
    const zip5 = to.zip ? to.zip.substring(0, 5) : '00000';

    // Build Ship To Y positions dynamically based on optional company & street2
    let curToY = 270;
    const toLinesZpl: string[] = [];

    toLinesZpl.push(`^FO60,${curToY}^A0N,38,38^FD${toName}^FS`);
    curToY += 42;

    if (toCompany) {
      toLinesZpl.push(`^FO60,${curToY}^A0N,28,28^FD${toCompany}^FS`);
      curToY += 34;
    }

    toLinesZpl.push(`^FO60,${curToY}^A0N,32,32^FD${toStreet1}^FS`);
    curToY += 38;

    if (toStreet2) {
      toLinesZpl.push(`^FO60,${curToY}^A0N,30,30^FD${toStreet2}^FS`);
      curToY += 36;
    }

    toLinesZpl.push(`^FO60,${curToY}^A0N,44,44^FD${toCityStateZip}^FS`);

    const zplLines = [
      '^XA',
      '^PW812',
      '^LL1218',
      '^LH0,0',
      '^CI28', // UTF-8 Encoding
      '',
      '// Outer Label Border',
      '^FO10,10^GB792,1198,3^FS',
      '',
      '// Header Carrier Banner',
      '^FO20,20^GB772,90,90^FS',
      `^FO40,38^A0N,55,55^FR^FD${carrier}^FS`,
      `^FO260,48^A0N,30,30^FR^FD${service.toUpperCase()}^FS`,
      '',
      '// Postage Indicia Box',
      '^FO530,120^GB250,95,2^FS',
      '^FO540,132^A0N,18,18^FDU.S. POSTAGE PAID^FS',
      `^FO540,154^A0N,18,18^FD${carrier} e-Postage^FS`,
      '^FO540,174^A0N,16,16^FDPermit No. G-10^FS',
      `^FO540,194^A0N,15,15^FD${dateStr}^FS`,
      '',
      '// Ship From Address Block',
      '^FO35,120^A0N,18,18^FDSHIP FROM:^FS',
      `^FO35,142^A0N,22,22^FD${fromName}^FS`,
      `^FO35,166^A0N,20,20^FD${fromStreet1}^FS`,
      fromStreet2 ? `^FO35,190^A0N,20,20^FD${fromStreet2}^FS` : '',
      `^FO35,${fromStreet2 ? 212 : 190}^A0N,20,20^FD${fromCityStateZip}^FS`,
      '',
      '// Divider Line',
      '^FO20,235^GB772,3,3^FS',
      '',
      '// Ship To Destination Block',
      '^FO40,248^A0N,20,20^FDSHIP TO:^FS',
      ...toLinesZpl,
      '',
      '// Divider Line',
      '^FO20,445^GB772,3,3^FS',
      '',
      '// Package & Weight Details',
      `^FO35,462^A0N,22,22^FDPKG: ${presetName}^FS`,
      `^FO420,462^A0N,22,22^FDWT: ${weightLbs} LBS (${weightOz} oz)^FS`,
      `^FO35,492^A0N,20,20^FDDIM: ${dimensions}^FS`,
      `^FO420,492^A0N,20,20^FDBILLABLE: ${billableWeight} LBS^FS`,
      '',
      '// Postal Routing Bar',
      '^FO20,525^GB772,55,2^FS',
      `^FO40,538^A0N,32,32^FDZIP ${zip5} - C022^FS`,
      '^FO710,538^A0N,28,28^FDeVS^FS',
      '',
      '// Barcode Section (Code 128)',
      `^FO406,595^A0N,24,24^FB812,1,0,C^FD${carrier.toUpperCase()} TRACKING #^FS`,
      '^BY3,3,140',
      `^FO70,630^BCN,140,N,N,N^FD>:${trackingNum}^FS`,
      `^FO406,785^A0N,34,34^FB812,1,0,C^FD${formattedTracking}^FS`,
      '',
      '// Order Reference Section',
      '^FO20,830^GB772,2,2^FS',
      `^FO35,845^A0N,22,22^FDORDER ID: ${orderId}^FS`,
      `^FO420,845^A0N,22,22^FDCARRIER: ${carrier}^FS`,
      cloverOrderId ? `^FO35,875^A0N,20,20^FDCLOVER ORDER: ${cloverOrderId}^FS` : '',
      `^FO420,875^A0N,20,20^FDSHIPPING COST: $${shipment.shippingCost.toFixed(2)}^FS`,
      '',
      '// AutoShip Thermal Branding Footer',
      '^FO20,1165^GB772,1,1^FS',
      '^FO35,1180^A0N,18,18^FDAutoShip Commercial Logistics Thermal Engine - 4x6 / 203 DPI^FS',
      '^FO530,1180^A0N,18,18^FDCommercial Base Pricing^FS',
      '',
      '^XZ',
    ].filter(Boolean);

    return zplLines.join('\n');
  }

  /**
   * Generates compact ESC/POS packing slip & proof-of-shipping receipt buffer
   * Supports Clover receipt widths: 80mm (48 columns) and 58mm (32 columns)
   */
  public generateEscPos(
    shipment: Shipment,
    options: { width?: ReceiptPaperWidth } = {}
  ): Buffer {
    const width = options.width || '80mm';
    const cols = width === '58mm' ? 32 : 48;
    const builder = new EscPosBuilder();

    const formattedTracking = this.formatTrackingNumber(shipment.trackingNumber);
    const dateStr = shipment.createdAt
      ? new Date(shipment.createdAt).toLocaleString('en-US', { hour12: true })
      : new Date().toLocaleString('en-US', { hour12: true });

    builder.init();

    // 1. Header (Centered, bold store info)
    const settings = db.getSettings();
    const merchantName = (settings.merchantName || 'AUTOSHIP MERCHANT').toUpperCase();

    builder
      .align('center')
      .bold(true)
      .doubleSize(true)
      .line(merchantName)
      .doubleSize(false)
      .line('PROOF OF SHIPPING / PACKING SLIP')
      .bold(false)
      .line(dateStr)
      .divider('=', cols);

    // 2. Order Details (Left aligned with two columns)
    builder
      .align('left')
      .bold(true)
      .line('SHIPMENT DETAILS')
      .bold(false)
      .twoColumn('Order ID:', shipment.orderId, cols);

    if (shipment.cloverOrderId) {
      builder.twoColumn('Clover Order:', shipment.cloverOrderId, cols);
    }

    builder
      .twoColumn('Carrier:', shipment.carrier, cols)
      .twoColumn('Service:', shipment.service, cols)
      .twoColumn('Status:', shipment.status.toUpperCase(), cols)
      .divider('-', cols);

    // 3. Recipient Information
    builder
      .bold(true)
      .line('SHIP TO:')
      .line(`  ${shipment.toAddress.name.toUpperCase()}`);

    if (shipment.toAddress.company) {
      builder.line(`  ${shipment.toAddress.company.toUpperCase()}`);
    }

    builder.line(`  ${shipment.toAddress.street1.toUpperCase()}`);
    if (shipment.toAddress.street2) {
      builder.line(`  ${shipment.toAddress.street2.toUpperCase()}`);
    }
    builder
      .line(
        `  ${shipment.toAddress.city.toUpperCase()}, ${shipment.toAddress.state.toUpperCase()} ${shipment.toAddress.zip}`
      )
      .bold(false)
      .divider('-', cols);

    // 4. Package Dimensions & Weight
    const parcel = shipment.parcel;
    builder
      .twoColumn('Package:', parcel.presetName || 'Custom', cols)
      .twoColumn('Weight:', `${parcel.totalWeightLbs} lbs (${parcel.totalWeightOz} oz)`, cols)
      .twoColumn('Dimensions:', `${parcel.lengthIn}x${parcel.widthIn}x${parcel.heightIn} in`, cols)
      .divider('-', cols);

    // 5. Line Items Packed
    builder
      .bold(true)
      .twoColumn('QTY', 'DESCRIPTION', cols)
      .bold(false);

    if (parcel.itemsPacked && parcel.itemsPacked.length > 0) {
      for (const item of parcel.itemsPacked) {
        const qtyPrefix = ` ${item.quantity}x `;
        const maxNameLen = cols - qtyPrefix.length;
        const name = item.name.length > maxNameLen ? item.name.substring(0, maxNameLen - 1) + '.' : item.name;
        builder.twoColumn(qtyPrefix, name, cols);
      }
    } else {
      builder.twoColumn(' 1x ', 'Standard Merchandise Shipment', cols);
    }

    builder.divider('-', cols);

    // 6. Tracking & Barcode
    builder
      .align('center')
      .bold(true)
      .line('CARRIER TRACKING NUMBER')
      .doubleHeight(true)
      .line(formattedTracking)
      .doubleHeight(false)
      .bold(false);

    // Print Code 128 barcode
    builder.barcode128(shipment.trackingNumber, 70);

    // 7. Footer
    builder
      .divider('=', cols)
      .align('center')
      .line('Retain this slip for package dispatch records.')
      .line('AutoShip Commercial Thermal Engine for Clover')
      .feed(4)
      .cut(true);

    return builder.toBuffer();
  }

  /**
   * Generates a clean plain text representation of the ESC/POS receipt
   * Useful for text display, test assertions, and audit logging
   */
  public generateReceiptText(shipment: Shipment, width: ReceiptPaperWidth = '80mm'): string {
    const cols = width === '58mm' ? 32 : 48;
    const settings = db.getSettings();
    const merchantName = (settings.merchantName || 'AUTOSHIP MERCHANT').toUpperCase();
    const formattedTracking = this.formatTrackingNumber(shipment.trackingNumber);
    const dateStr = shipment.createdAt
      ? new Date(shipment.createdAt).toLocaleString('en-US', { hour12: true })
      : new Date().toLocaleString('en-US', { hour12: true });

    const center = (text: string): string => {
      if (text.length >= cols) return text.substring(0, cols);
      const pad = Math.floor((cols - text.length) / 2);
      return ' '.repeat(pad) + text;
    };

    const twoCol = (left: string, right: string): string => {
      const space = cols - left.length - right.length;
      if (space <= 0) return `${left} ${right}`.substring(0, cols);
      return left + ' '.repeat(space) + right;
    };

    const lines: string[] = [
      center(merchantName),
      center('PROOF OF SHIPPING / PACKING SLIP'),
      center(dateStr),
      '='.repeat(cols),
      'SHIPMENT DETAILS',
      twoCol('Order ID:', shipment.orderId),
    ];

    if (shipment.cloverOrderId) {
      lines.push(twoCol('Clover Order:', shipment.cloverOrderId));
    }

    lines.push(
      twoCol('Carrier:', shipment.carrier),
      twoCol('Service:', shipment.service),
      twoCol('Status:', shipment.status.toUpperCase()),
      '-'.repeat(cols),
      'SHIP TO:',
      `  ${shipment.toAddress.name.toUpperCase()}`
    );

    if (shipment.toAddress.company) {
      lines.push(`  ${shipment.toAddress.company.toUpperCase()}`);
    }

    lines.push(
      `  ${shipment.toAddress.street1.toUpperCase()}`,
      shipment.toAddress.street2 ? `  ${shipment.toAddress.street2.toUpperCase()}` : '',
      `  ${shipment.toAddress.city.toUpperCase()}, ${shipment.toAddress.state.toUpperCase()} ${shipment.toAddress.zip}`,
      '-'.repeat(cols),
      twoCol('Package:', shipment.parcel.presetName || 'Custom'),
      twoCol('Weight:', `${shipment.parcel.totalWeightLbs} lbs (${shipment.parcel.totalWeightOz} oz)`),
      twoCol('Dimensions:', `${shipment.parcel.lengthIn}x${shipment.parcel.widthIn}x${shipment.parcel.heightIn} in`),
      '-'.repeat(cols),
      twoCol('QTY', 'DESCRIPTION')
    );

    if (shipment.parcel.itemsPacked && shipment.parcel.itemsPacked.length > 0) {
      for (const item of shipment.parcel.itemsPacked) {
        const qty = ` ${item.quantity}x `;
        lines.push(twoCol(qty, item.name));
      }
    } else {
      lines.push(twoCol(' 1x ', 'Standard Merchandise Shipment'));
    }

    lines.push(
      '-'.repeat(cols),
      center('CARRIER TRACKING NUMBER'),
      center(formattedTracking),
      center(`[BARCODE: ${shipment.trackingNumber}]`),
      '='.repeat(cols),
      center('Retain this slip for package dispatch records.'),
      center('AutoShip Commercial Thermal Engine for Clover')
    );

    return lines.filter((l) => l !== '').join('\n');
  }

  /**
   * Tests TCP socket connectivity to a network thermal printer on RAW port 9100
   */
  public async testPrinterConnection(
    printerIp: string,
    printerPort: number = 9100,
    timeoutMs: number = 3000
  ): Promise<PrinterTestResult> {
    const startTime = Date.now();

    if (!printerIp || typeof printerIp !== 'string') {
      return {
        success: false,
        ip: printerIp || '',
        port: printerPort,
        error: 'Printer IP address must be a valid IPv4 or hostname',
      };
    }

    return new Promise<PrinterTestResult>((resolve) => {
      let resolved = false;
      const socket = new net.Socket();

      const finish = (result: PrinterTestResult) => {
        if (!resolved) {
          resolved = true;
          socket.removeAllListeners();
          socket.destroy();
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        finish({
          success: false,
          ip: printerIp,
          port: printerPort,
          error: `Connection to printer at ${printerIp}:${printerPort} timed out after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      socket.connect(printerPort, printerIp, () => {
        clearTimeout(timer);
        const latencyMs = Date.now() - startTime;
        finish({
          success: true,
          ip: printerIp,
          port: printerPort,
          latencyMs,
        });
      });

      socket.on('error', (err: any) => {
        clearTimeout(timer);
        finish({
          success: false,
          ip: printerIp,
          port: printerPort,
          error: `Printer socket connection failed: ${err.message}`,
        });
      });
    });
  }

  /**
   * Dispatches raw data (ZPL string or ESC/POS Buffer) to network thermal printer via TCP socket
   */
  public async sendRawSocket(
    printerIp: string,
    printerPort: number = 9100,
    data: Buffer | string,
    timeoutMs: number = 8000
  ): Promise<{ success: boolean; bytesWritten: number; message: string }> {
    if (!printerIp || typeof printerIp !== 'string') {
      throw new Error('Printer IP address is required');
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');

    return new Promise((resolve, reject) => {
      let resolved = false;
      const socket = new net.Socket();

      const finish = (err?: Error, bytesWritten: number = 0) => {
        if (!resolved) {
          resolved = true;
          socket.removeAllListeners();
          if (err && !socket.destroyed) {
            socket.destroy();
          }
          if (err) {
            reject(err);
          } else {
            resolve({
              success: true,
              bytesWritten,
              message: `Successfully transmitted ${bytesWritten} bytes to thermal printer at ${printerIp}:${printerPort}`,
            });
          }
        }
      };

      const timer = setTimeout(() => {
        finish(new Error(`Print job socket connection timed out after ${timeoutMs}ms (${printerIp}:${printerPort})`));
      }, timeoutMs);

      socket.on('close', () => {
        clearTimeout(timer);
        finish(undefined, buffer.length);
      });

      socket.connect(printerPort, printerIp, () => {
        socket.write(buffer, (writeErr) => {
          if (writeErr) {
            clearTimeout(timer);
            finish(new Error(`Failed to write print data to socket: ${writeErr.message}`));
            return;
          }
          // End connection gracefully after buffer is flushed
          socket.end();
        });
      });

      socket.on('error', (err: any) => {
        clearTimeout(timer);
        finish(new Error(`TCP Socket error while communicating with ${printerIp}:${printerPort}: ${err.message}`));
      });
    });
  }

  /**
   * Dispatches a print job for an existing shipment to a network thermal printer
   */
  public async printShipment(
    shipmentId: string,
    options: {
      printerIp?: string;
      printerPort?: number;
      format?: ThermalPrintFormat;
      paperWidth?: ReceiptPaperWidth;
      copies?: number;
    }
  ): Promise<PrintJobResult> {
    const shipment = db.getShipmentById(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment "${shipmentId}" not found`);
    }

    const settings = db.getSettings();
    const printerIp = options.printerIp || settings.defaultPrinterIp;
    if (!printerIp) {
      throw new Error(
        'Printer IP is required. Provide printerIp in request body or set defaultPrinterIp in Merchant Settings.'
      );
    }

    const printerPort = options.printerPort || settings.defaultPrinterPort || 9100;
    const format = options.format || settings.defaultPrinterFormat || 'ZPL';
    const paperWidth = options.paperWidth || '80mm';
    const copies = Math.max(1, Math.min(10, options.copies || 1));

    let payload: Buffer | string;
    if (format === 'ZPL') {
      const singleZpl = this.generateZpl(shipment);
      if (copies > 1) {
        // Repeat ZPL label for requested copies
        payload = Array(copies).fill(singleZpl).join('\n');
      } else {
        payload = singleZpl;
      }
    } else {
      const singleEscPos = this.generateEscPos(shipment, { width: paperWidth });
      if (copies > 1) {
        payload = Buffer.concat(Array(copies).fill(singleEscPos));
      } else {
        payload = singleEscPos;
      }
    }

    const socketResult = await this.sendRawSocket(printerIp, printerPort, payload);

    return {
      success: true,
      jobId: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      format,
      bytesSent: socketResult.bytesWritten,
      printerIp,
      printerPort,
      message: socketResult.message,
      timestamp: new Date().toISOString(),
    };
  }
}

export const printerService = new PrinterService();
