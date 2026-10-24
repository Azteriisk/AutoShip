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

export const DEFAULT_MERCHANT_ID = 'MERCHANT_CLOVER_12345';

export interface MerchantStoreData {
  settings: MerchantSettings;
  presets: PackagePreset[];
  catalog: Item[];
  promoCodes: PromoCode[];
  shipments: Shipment[];
}

export interface WebhookLogEntry {
  id: string;
  timestamp: string;
  topic: string;
  payload: any;
  status: string;
  error?: string;
  merchantId?: string;
}

export interface AutoShipDataStore {
  merchants: Record<string, MerchantStoreData>;
  webhookLogs: WebhookLogEntry[];
  settings?: MerchantSettings;
  presets?: PackagePreset[];
  catalog?: Item[];
  promoCodes?: PromoCode[];
  shipments?: Shipment[];
}

const DEFAULT_PRESETS: PackagePreset[] = [
  {
    id: 'preset_padded_envelope',
    merchantId: DEFAULT_MERCHANT_ID,
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
    merchantId: DEFAULT_MERCHANT_ID,
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
    merchantId: DEFAULT_MERCHANT_ID,
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
    merchantId: DEFAULT_MERCHANT_ID,
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
    merchantId: DEFAULT_MERCHANT_ID,
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
  merchantId: DEFAULT_MERCHANT_ID,
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
    merchantId: DEFAULT_MERCHANT_ID,
    code: 'FREESHIP',
    discountType: 'free_shipping',
    discountValue: 100,
    minOrderAmount: 0,
    active: true,
    usageCount: 14,
  },
  {
    id: 'promo_ship_50',
    merchantId: DEFAULT_MERCHANT_ID,
    code: 'SHIP50',
    discountType: 'percentage',
    discountValue: 50,
    minOrderAmount: 25,
    active: true,
    usageCount: 8,
  },
  {
    id: 'promo_flat_5',
    merchantId: DEFAULT_MERCHANT_ID,
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
    merchantId: DEFAULT_MERCHANT_ID,
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
    merchantId: DEFAULT_MERCHANT_ID,
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
    merchantId: DEFAULT_MERCHANT_ID,
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
    merchantId: DEFAULT_MERCHANT_ID,
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
    merchantId: DEFAULT_MERCHANT_ID,
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

function createMerchantDefaults(merchantId: string): MerchantStoreData {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      merchantId,
      merchantName:
        merchantId === DEFAULT_MERCHANT_ID
          ? 'AutoShip Merchant Store'
          : `AutoShip Store (${merchantId})`,
    },
    presets: DEFAULT_PRESETS.map((p) => ({ ...p, merchantId })),
    catalog: DEFAULT_CATALOG.map((c) => ({ ...c, merchantId })),
    promoCodes: DEFAULT_PROMO_CODES.map((pr) => ({ ...pr, merchantId })),
    shipments: [],
  };
}

export class Database {
  private static instance: Database;
  private filePath: string;
  private data: AutoShipDataStore;
  private quotesCache: Map<string, RateQuoteResponse> = new Map();
  public readonly defaultMerchantId: string = DEFAULT_MERCHANT_ID;

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
    let parsed: any = null;
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        parsed = JSON.parse(raw);
      } catch (err) {
        console.warn('Failed to parse existing autoship data file, falling back to defaults:', err);
      }
    }

    const merchants: Record<string, MerchantStoreData> = {};

    // 1. If multi-tenant 'merchants' map exists in file
    if (parsed?.merchants && typeof parsed.merchants === 'object') {
      for (const [mid, store] of Object.entries<any>(parsed.merchants)) {
        if (!store || typeof store !== 'object') continue;
        const defaultStore = createMerchantDefaults(mid);
        merchants[mid] = {
          settings: { ...defaultStore.settings, ...(store.settings || {}), merchantId: mid },
          presets:
            store.presets && Array.isArray(store.presets) && store.presets.length > 0
              ? store.presets.map((p: PackagePreset) => ({ ...p, merchantId: p.merchantId || mid }))
              : defaultStore.presets,
          catalog:
            store.catalog && Array.isArray(store.catalog) && store.catalog.length > 0
              ? store.catalog.map((c: Item) => ({ ...c, merchantId: c.merchantId || mid }))
              : defaultStore.catalog,
          promoCodes:
            store.promoCodes && Array.isArray(store.promoCodes) && store.promoCodes.length > 0
              ? store.promoCodes.map((pr: PromoCode) => ({
                  ...pr,
                  merchantId: pr.merchantId || mid,
                }))
              : defaultStore.promoCodes,
          shipments: Array.isArray(store.shipments)
            ? store.shipments.map((s: Shipment) => ({ ...s, merchantId: s.merchantId || mid }))
            : [],
        };
      }
    }

    // 2. Ensure default merchant exists (or migrate from legacy root-level structure)
    const primaryId = parsed?.settings?.merchantId || this.defaultMerchantId;
    if (!merchants[primaryId]) {
      const defaultStore = createMerchantDefaults(primaryId);
      merchants[primaryId] = {
        settings: {
          ...defaultStore.settings,
          ...(parsed?.settings || {}),
          merchantId: primaryId,
        },
        presets:
          parsed?.presets && Array.isArray(parsed.presets) && parsed.presets.length > 0
            ? parsed.presets.map((p: PackagePreset) => ({
                ...p,
                merchantId: p.merchantId || primaryId,
              }))
            : defaultStore.presets,
        catalog:
          parsed?.catalog && Array.isArray(parsed.catalog) && parsed.catalog.length > 0
            ? parsed.catalog.map((c: Item) => ({ ...c, merchantId: c.merchantId || primaryId }))
            : defaultStore.catalog,
        promoCodes:
          parsed?.promoCodes && Array.isArray(parsed.promoCodes) && parsed.promoCodes.length > 0
            ? parsed.promoCodes.map((pr: PromoCode) => ({
                ...pr,
                merchantId: pr.merchantId || primaryId,
              }))
            : defaultStore.promoCodes,
        shipments: Array.isArray(parsed?.shipments)
          ? parsed.shipments.map((s: Shipment) => ({ ...s, merchantId: s.merchantId || primaryId }))
          : [],
      };
    }

    // Also ensure DEFAULT_MERCHANT_ID key exists if primaryId was custom
    if (!merchants[this.defaultMerchantId]) {
      merchants[this.defaultMerchantId] = createMerchantDefaults(this.defaultMerchantId);
    }

    const initial: AutoShipDataStore = {
      merchants,
      webhookLogs: Array.isArray(parsed?.webhookLogs) ? parsed.webhookLogs : [],
    };

    this.saveData(initial);
    return initial;
  }

  private saveData(dataToSave: AutoShipDataStore = this.data): void {
    try {
      const defaultStore =
        dataToSave.merchants[this.defaultMerchantId] ||
        createMerchantDefaults(this.defaultMerchantId);
      const toPersist: AutoShipDataStore = {
        merchants: dataToSave.merchants,
        webhookLogs: dataToSave.webhookLogs,
        settings: defaultStore.settings,
        presets: defaultStore.presets,
        catalog: defaultStore.catalog,
        promoCodes: defaultStore.promoCodes,
        shipments: defaultStore.shipments,
      };

      const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(toPersist, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      try {
        const defaultStore =
          dataToSave.merchants[this.defaultMerchantId] ||
          createMerchantDefaults(this.defaultMerchantId);
        const toPersist: AutoShipDataStore = {
          merchants: dataToSave.merchants,
          webhookLogs: dataToSave.webhookLogs,
          settings: defaultStore.settings,
          presets: defaultStore.presets,
          catalog: defaultStore.catalog,
          promoCodes: defaultStore.promoCodes,
          shipments: defaultStore.shipments,
        };
        fs.writeFileSync(this.filePath, JSON.stringify(toPersist, null, 2), 'utf-8');
      } catch (e) {
        console.warn('Could not persist autoship data to disk (in-memory store active):', e);
      }
    }
  }

  private getMerchantStore(merchantId?: string): MerchantStoreData {
    const targetId = merchantId || this.defaultMerchantId;
    if (!this.data.merchants[targetId]) {
      this.data.merchants[targetId] = createMerchantDefaults(targetId);
      this.saveData();
    }
    return this.data.merchants[targetId];
  }

  // Settings
  public getSettings(merchantId?: string): MerchantSettings {
    const store = this.getMerchantStore(merchantId);
    return { ...store.settings };
  }

  public updateSettings(
    updates: Partial<MerchantSettings>,
    merchantId?: string
  ): MerchantSettings {
    const targetId = merchantId || updates.merchantId || this.defaultMerchantId;
    const store = this.getMerchantStore(targetId);
    store.settings = {
      ...store.settings,
      ...updates,
      merchantId: targetId,
    };
    this.saveData();
    return this.getSettings(targetId);
  }

  // Presets
  public getPresets(merchantId?: string): PackagePreset[] {
    const store = this.getMerchantStore(merchantId);
    return [...store.presets];
  }

  public savePreset(preset: PackagePreset, merchantId?: string): PackagePreset {
    const targetId = merchantId || preset.merchantId || this.defaultMerchantId;
    const store = this.getMerchantStore(targetId);
    const toSave: PackagePreset = { ...preset, merchantId: targetId };
    const idx = store.presets.findIndex((p) => p.id === toSave.id);
    if (idx >= 0) {
      store.presets[idx] = toSave;
    } else {
      store.presets.push(toSave);
    }
    this.saveData();
    return toSave;
  }

  public deletePreset(id: string, merchantId?: string): boolean {
    const targetId = merchantId || this.defaultMerchantId;
    const store = this.getMerchantStore(targetId);
    const initialLen = store.presets.length;
    store.presets = store.presets.filter((p) => p.id !== id);
    if (store.presets.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  // Catalog
  public getCatalog(merchantId?: string): Item[] {
    const store = this.getMerchantStore(merchantId);
    return [...store.catalog];
  }

  public getCatalogItem(id: string, merchantId?: string): Item | undefined {
    if (merchantId) {
      return this.getMerchantStore(merchantId).catalog.find(
        (i) => i.id === id || i.sku === id
      );
    }
    const defaultStore = this.getMerchantStore(this.defaultMerchantId);
    const found = defaultStore.catalog.find((i) => i.id === id || i.sku === id);
    if (found) return found;

    for (const [mId, store] of Object.entries(this.data.merchants)) {
      if (mId === this.defaultMerchantId) continue;
      const match = store.catalog.find((i) => i.id === id || i.sku === id);
      if (match) return match;
    }
    return undefined;
  }

  public saveCatalogItem(item: Item, merchantId?: string): Item {
    const targetId = merchantId || item.merchantId || this.defaultMerchantId;
    const store = this.getMerchantStore(targetId);
    const toSave: Item = { ...item, merchantId: targetId };
    const idx = store.catalog.findIndex((i) => i.id === toSave.id);
    if (idx >= 0) {
      store.catalog[idx] = toSave;
    } else {
      store.catalog.push(toSave);
    }
    this.saveData();
    return toSave;
  }

  public deleteCatalogItem(id: string, merchantId?: string): boolean {
    const targetId = merchantId || this.defaultMerchantId;
    const store = this.getMerchantStore(targetId);
    const initialLen = store.catalog.length;
    store.catalog = store.catalog.filter((i) => i.id !== id);
    if (store.catalog.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  // Promo Codes
  public getPromoCodes(merchantId?: string): PromoCode[] {
    const store = this.getMerchantStore(merchantId);
    return [...store.promoCodes];
  }

  public getPromoCodeByCode(code: string, merchantId?: string): PromoCode | undefined {
    const normalized = code.trim().toUpperCase();
    if (merchantId) {
      return this.getMerchantStore(merchantId).promoCodes.find(
        (p) => p.code.trim().toUpperCase() === normalized && p.active
      );
    }
    const defaultStore = this.getMerchantStore(this.defaultMerchantId);
    const found = defaultStore.promoCodes.find(
      (p) => p.code.trim().toUpperCase() === normalized && p.active
    );
    if (found) return found;

    for (const [mId, store] of Object.entries(this.data.merchants)) {
      if (mId === this.defaultMerchantId) continue;
      const match = store.promoCodes.find(
        (p) => p.code.trim().toUpperCase() === normalized && p.active
      );
      if (match) return match;
    }
    return undefined;
  }

  public savePromoCode(promo: PromoCode, merchantId?: string): PromoCode {
    const targetId = merchantId || promo.merchantId || this.defaultMerchantId;
    const store = this.getMerchantStore(targetId);
    const toSave: PromoCode = { ...promo, merchantId: targetId };
    const idx = store.promoCodes.findIndex((p) => p.id === toSave.id);
    if (idx >= 0) {
      store.promoCodes[idx] = toSave;
    } else {
      store.promoCodes.push(toSave);
    }
    this.saveData();
    return toSave;
  }

  public incrementPromoUsage(code: string, merchantId?: string): void {
    const normalized = code.trim().toUpperCase();
    if (merchantId) {
      const store = this.getMerchantStore(merchantId);
      const promo = store.promoCodes.find((p) => p.code.trim().toUpperCase() === normalized);
      if (promo) {
        promo.usageCount += 1;
        this.saveData();
      }
      return;
    }
    const defaultPromo = this.getMerchantStore(this.defaultMerchantId).promoCodes.find(
      (p) => p.code.trim().toUpperCase() === normalized
    );
    if (defaultPromo) {
      defaultPromo.usageCount += 1;
      this.saveData();
      return;
    }
    for (const [mId, store] of Object.entries(this.data.merchants)) {
      if (mId === this.defaultMerchantId) continue;
      const match = store.promoCodes.find((p) => p.code.trim().toUpperCase() === normalized);
      if (match) {
        match.usageCount += 1;
        this.saveData();
        return;
      }
    }
  }

  public deletePromoCode(id: string, merchantId?: string): boolean {
    const targetId = merchantId || this.defaultMerchantId;
    const store = this.getMerchantStore(targetId);
    const initialLen = store.promoCodes.length;
    store.promoCodes = store.promoCodes.filter((p) => p.id !== id);
    if (store.promoCodes.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  // Shipments
  public getShipments(merchantId?: string): Shipment[] {
    const store = this.getMerchantStore(merchantId);
    return [...store.shipments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getAllShipments(): Shipment[] {
    const all: Shipment[] = [];
    for (const store of Object.values(this.data.merchants)) {
      all.push(...store.shipments);
    }
    return all.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getShipmentById(id: string, merchantId?: string): Shipment | undefined {
    if (merchantId) {
      const store = this.getMerchantStore(merchantId);
      return store.shipments.find((s) => s.id === id || s.trackingNumber === id);
    }
    const defaultStore = this.getMerchantStore(this.defaultMerchantId);
    const found = defaultStore.shipments.find((s) => s.id === id || s.trackingNumber === id);
    if (found) return found;

    for (const [mId, store] of Object.entries(this.data.merchants)) {
      if (mId === this.defaultMerchantId) continue;
      const match = store.shipments.find((s) => s.id === id || s.trackingNumber === id);
      if (match) return match;
    }
    return undefined;
  }

  public getShipmentByOrderId(orderId: string, merchantId?: string): Shipment | undefined {
    if (merchantId) {
      const store = this.getMerchantStore(merchantId);
      return store.shipments.find(
        (s) => s.orderId === orderId || s.cloverOrderId === orderId
      );
    }
    const defaultStore = this.getMerchantStore(this.defaultMerchantId);
    const found = defaultStore.shipments.find(
      (s) => s.orderId === orderId || s.cloverOrderId === orderId
    );
    if (found) return found;

    for (const [mId, store] of Object.entries(this.data.merchants)) {
      if (mId === this.defaultMerchantId) continue;
      const match = store.shipments.find(
        (s) => s.orderId === orderId || s.cloverOrderId === orderId
      );
      if (match) return match;
    }
    return undefined;
  }

  public saveShipment(shipment: Shipment, merchantId?: string): Shipment {
    const targetId = merchantId || shipment.merchantId || this.defaultMerchantId;
    const store = this.getMerchantStore(targetId);
    const toSave: Shipment = { ...shipment, merchantId: targetId };
    const idx = store.shipments.findIndex((s) => s.id === toSave.id);
    if (idx >= 0) {
      store.shipments[idx] = toSave;
    } else {
      store.shipments.unshift(toSave);
    }
    this.saveData();
    return toSave;
  }

  // Quote caching
  public saveQuote(quote: RateQuoteResponse): void {
    this.quotesCache.set(quote.quoteId, quote);
  }

  public getQuote(quoteId: string): RateQuoteResponse | undefined {
    return this.quotesCache.get(quoteId);
  }

  // Webhook Logs
  public logWebhook(
    topic: string,
    payload: any,
    status: string,
    error?: string,
    merchantId?: string
  ): void {
    const logEntry: WebhookLogEntry = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      topic,
      payload,
      status,
      error,
      merchantId,
    };
    this.data.webhookLogs.unshift(logEntry);
    if (this.data.webhookLogs.length > 100) {
      this.data.webhookLogs.pop();
    }
    this.saveData();
  }

  public getWebhookLogs(merchantId?: string): WebhookLogEntry[] {
    if (merchantId) {
      return this.data.webhookLogs.filter(
        (log) => !log.merchantId || log.merchantId === merchantId
      );
    }
    return [...this.data.webhookLogs];
  }

  // Multi-merchant Management
  public getMerchants(): string[] {
    return Object.keys(this.data.merchants);
  }

  public hasMerchant(merchantId: string): boolean {
    return !!this.data.merchants[merchantId];
  }
}

export const db = Database.getInstance();
