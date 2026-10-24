import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  MerchantSettings,
  PackagePreset,
  PromoCode,
  Shipment,
  Item,
  RateQuoteResponse,
} from '../types/index.js';

export interface AutoShipDataStore {
  settings: MerchantSettings;
  presets: PackagePreset[];
  catalog: Item[];
  promoCodes: PromoCode[];
  shipments: Shipment[];
  webhookLogs: Array<{
    id: string;
    timestamp: string;
    topic: string;
    payload: any;
    status: string;
    error?: string;
  }>;
}

const DEFAULT_PRESETS: PackagePreset[] = [
  {
    id: 'preset_padded_envelope',
    name: 'Padded Bubble Mailer',
    type: 'envelope',
    lengthIn: 12.5,
    widthIn: 9.5,
    heightIn: 1.0,
    maxWeightOz: 64, // 4 lbs
    tareWeightOz: 1.5,
    isDefault: false,
  },
  {
    id: 'preset_small_box',
    name: 'Small Box',
    type: 'box',
    lengthIn: 6.0,
    widthIn: 4.0,
    heightIn: 3.0,
    maxWeightOz: 80, // 5 lbs
    tareWeightOz: 3.0,
    isDefault: false,
  },
  {
    id: 'preset_medium_box',
    name: 'Medium Box (Standard)',
    type: 'box',
    lengthIn: 10.0,
    widthIn: 7.0,
    heightIn: 5.0,
    maxWeightOz: 320, // 20 lbs
    tareWeightOz: 6.0,
    isDefault: true,
  },
  {
    id: 'preset_large_box',
    name: 'Large Box',
    type: 'box',
    lengthIn: 14.0,
    widthIn: 10.0,
    heightIn: 8.0,
    maxWeightOz: 640, // 40 lbs
    tareWeightOz: 10.0,
    isDefault: false,
  },
  {
    id: 'preset_extra_large_box',
    name: 'Extra Large Box',
    type: 'box',
    lengthIn: 20.0,
    widthIn: 16.0,
    heightIn: 12.0,
    maxWeightOz: 1120, // 70 lbs
    tareWeightOz: 18.0,
    isDefault: false,
  },
];

const DEFAULT_SETTINGS: MerchantSettings = {
  merchantId: 'MERCHANT_CLOVER_12345',
  merchantName: 'AutoShip Merchant Store',
  planTier: 'growth',
  billingCycleMonth: new Date().toISOString().substring(0, 7),
  shipmentsCountThisMonth: 0,
  originAddress: {
    name: 'AutoShip Fulfillment Hub',
    company: 'AutoShip Merchant Store',
    street1: '123 Commerce Blvd',
    street2: 'Suite 400',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    country: 'US',
    phone: '512-555-0199',
    email: 'shipping@autoshipboutique.com',
    isResidential: false,
  },
  easyPostApiKey: process.env.EASYPOST_API_KEY || '',
  useMockCarrier: false,
  enabledCarriers: {
    USPS: true,
    UPS: true,
    FedEx: true,
  },
  defaultCarrier: 'USPS',
  defaultService: 'USPS Ground Advantage',
  freeShippingThreshold: 100.0, // Free standard shipping for orders >= $100
  enableFreeShippingThreshold: true,
  insuranceRatePerHundred: 1.05, // $1.05 per $100 declared value
  deliveryGuaranteeFee: 2.99, // $2.99 guarantee fee
  markupPercentage: 0,
};

const DEFAULT_PROMO_CODES: PromoCode[] = [
  {
    id: 'promo_free_ship',
    code: 'FREESHIP',
    discountType: 'free_shipping',
    discountValue: 100,
    minOrderAmount: 0,
    active: true,
    usageCount: 14,
  },
  {
    id: 'promo_ship_50',
    code: 'SHIP50',
    discountType: 'percentage',
    discountValue: 50,
    minOrderAmount: 25,
    active: true,
    usageCount: 8,
  },
  {
    id: 'promo_flat_5',
    code: 'FLAT5',
    discountType: 'fixed_amount',
    discountValue: 5.0,
    minOrderAmount: 30,
    active: true,
    usageCount: 22,
  },
];

const DEFAULT_CATALOG: Item[] = [
  {
    id: 'item_tee',
    sku: 'APP-TSHIRT-01',
    name: 'Organic Cotton T-Shirt',
    quantity: 1,
    price: 28.0,
    weightOz: 7.5,
    lengthIn: 9.0,
    widthIn: 7.0,
    heightIn: 0.8,
  },
  {
    id: 'item_hoodie',
    sku: 'APP-HOODIE-BLK',
    name: 'Fleece Heavyweight Hoodie',
    quantity: 1,
    price: 65.0,
    weightOz: 24.0,
    lengthIn: 11.0,
    widthIn: 8.5,
    heightIn: 3.5,
  },
  {
    id: 'item_mug',
    sku: 'HOME-MUG-CERAM',
    name: 'Ceramic Artisan Coffee Mug',
    quantity: 1,
    price: 18.5,
    weightOz: 14.0,
    lengthIn: 4.5,
    widthIn: 4.5,
    heightIn: 4.5,
  },
  {
    id: 'item_plate',
    sku: 'HOME-PLATE-SET',
    name: 'Dinnerware Ceramic Plate (Set of 2)',
    quantity: 1,
    price: 45.0,
    weightOz: 36.0,
    lengthIn: 10.5,
    widthIn: 10.5,
    heightIn: 2.5,
  },
  {
    id: 'item_candle',
    sku: 'WELL-SOY-CANDLE',
    name: 'Scented Soy Wax Candle',
    quantity: 1,
    price: 22.0,
    weightOz: 16.0,
    lengthIn: 3.5,
    widthIn: 3.5,
    heightIn: 4.0,
  },
];

export class Database {
  private static instance: Database;
  private filePath: string;
  private data: AutoShipDataStore;
  private quotesCache: Map<string, RateQuoteResponse> = new Map();

  private constructor() {
    let dataDir = path.resolve(process.cwd(), 'data');
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      dataDir = path.join(os.tmpdir(), 'autoship-data');
    }
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch {
      dataDir = path.join(os.tmpdir(), 'autoship-data');
      try {
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
      } catch {
        // Fallback for read-only environment
      }
    }
    const fileName =
      process.env.AUTOSHIP_DATA_FILE ||
      (process.env.NODE_ENV === 'test' ? 'autoship.test.json' : 'autoship.json');
    this.filePath = path.join(dataDir, fileName);
    this.data = this.loadData();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private loadData(): AutoShipDataStore {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          presets: parsed.presets?.length ? parsed.presets : DEFAULT_PRESETS,
          catalog: parsed.catalog?.length ? parsed.catalog : DEFAULT_CATALOG,
          promoCodes: parsed.promoCodes?.length ? parsed.promoCodes : DEFAULT_PROMO_CODES,
          shipments: parsed.shipments || [],
          webhookLogs: parsed.webhookLogs || [],
        };
      } catch (err) {
        console.warn('Failed to parse existing autoship.json, falling back to defaults:', err);
      }
    }
    const initial: AutoShipDataStore = {
      settings: DEFAULT_SETTINGS,
      presets: DEFAULT_PRESETS,
      catalog: DEFAULT_CATALOG,
      promoCodes: DEFAULT_PROMO_CODES,
      shipments: [],
      webhookLogs: [],
    };
    this.saveData(initial);
    return initial;
  }

  private saveData(dataToSave: AutoShipDataStore = this.data): void {
    try {
      const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      try {
        fs.writeFileSync(this.filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      } catch (e) {
        console.warn('Could not persist autoship data to disk (in-memory store active):', e);
      }
    }
  }

  // Settings
  public getSettings(): MerchantSettings {
    return { ...this.data.settings };
  }

  public updateSettings(updates: Partial<MerchantSettings>): MerchantSettings {
    this.data.settings = { ...this.data.settings, ...updates };
    this.saveData();
    return this.getSettings();
  }

  // Presets
  public getPresets(): PackagePreset[] {
    return [...this.data.presets];
  }

  public savePreset(preset: PackagePreset): PackagePreset {
    const idx = this.data.presets.findIndex((p) => p.id === preset.id);
    if (idx >= 0) {
      this.data.presets[idx] = preset;
    } else {
      this.data.presets.push(preset);
    }
    this.saveData();
    return preset;
  }

  public deletePreset(id: string): boolean {
    const initialLen = this.data.presets.length;
    this.data.presets = this.data.presets.filter((p) => p.id !== id);
    if (this.data.presets.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  // Catalog
  public getCatalog(): Item[] {
    return [...this.data.catalog];
  }

  public getCatalogItem(id: string): Item | undefined {
    return this.data.catalog.find((i) => i.id === id || i.sku === id);
  }

  // Promo Codes
  public getPromoCodes(): PromoCode[] {
    return [...this.data.promoCodes];
  }

  public getPromoCodeByCode(code: string): PromoCode | undefined {
    return this.data.promoCodes.find(
      (p) => p.code.trim().toUpperCase() === code.trim().toUpperCase() && p.active
    );
  }

  public savePromoCode(promo: PromoCode): PromoCode {
    const idx = this.data.promoCodes.findIndex((p) => p.id === promo.id);
    if (idx >= 0) {
      this.data.promoCodes[idx] = promo;
    } else {
      this.data.promoCodes.push(promo);
    }
    this.saveData();
    return promo;
  }

  public incrementPromoUsage(code: string): void {
    const promo = this.data.promoCodes.find(
      (p) => p.code.trim().toUpperCase() === code.trim().toUpperCase()
    );
    if (promo) {
      promo.usageCount += 1;
      this.saveData();
    }
  }

  public deletePromoCode(id: string): boolean {
    const initialLen = this.data.promoCodes.length;
    this.data.promoCodes = this.data.promoCodes.filter((p) => p.id !== id);
    if (this.data.promoCodes.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  // Shipments
  public getShipments(): Shipment[] {
    return [...this.data.shipments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getShipmentById(id: string): Shipment | undefined {
    return this.data.shipments.find((s) => s.id === id || s.trackingNumber === id);
  }

  public getShipmentByOrderId(orderId: string): Shipment | undefined {
    return this.data.shipments.find(
      (s) => s.orderId === orderId || s.cloverOrderId === orderId
    );
  }

  public saveShipment(shipment: Shipment): Shipment {
    const idx = this.data.shipments.findIndex((s) => s.id === shipment.id);
    if (idx >= 0) {
      this.data.shipments[idx] = shipment;
    } else {
      this.data.shipments.unshift(shipment);
    }
    this.saveData();
    return shipment;
  }

  // Quote caching
  public saveQuote(quote: RateQuoteResponse): void {
    this.quotesCache.set(quote.quoteId, quote);
  }

  public getQuote(quoteId: string): RateQuoteResponse | undefined {
    return this.quotesCache.get(quoteId);
  }

  // Webhook Logs
  public logWebhook(topic: string, payload: any, status: string, error?: string): void {
    const logEntry = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      topic,
      payload,
      status,
      error,
    };
    this.data.webhookLogs.unshift(logEntry);
    if (this.data.webhookLogs.length > 100) {
      this.data.webhookLogs.pop();
    }
    this.saveData();
  }

  public getWebhookLogs() {
    return [...this.data.webhookLogs];
  }
}

export const db = Database.getInstance();
