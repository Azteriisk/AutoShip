export type CarrierCode = 'USPS' | 'UPS' | 'FedEx';

export interface Address {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string; // ISO 2-letter, e.g. 'US'
  phone?: string;
  email?: string;
  isResidential?: boolean;
}

export interface Item {
  id: string;
  sku?: string;
  name: string;
  quantity: number;
  price: number; // in dollars (e.g. 19.99)
  weightOz: number; // in ounces
  lengthIn: number; // in inches
  widthIn: number; // in inches
  heightIn: number; // in inches
  merchantId?: string;
}

export interface PackagePreset {
  id: string;
  name: string;
  type: 'box' | 'envelope' | 'custom';
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  maxWeightOz: number;
  tareWeightOz: number;
  isDefault?: boolean;
  merchantId?: string;
}

export interface PackedPackage {
  presetId: string;
  presetName: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  itemWeightOz: number;
  tareWeightOz: number;
  totalWeightOz: number;
  totalWeightLbs: number;
  billableWeightLbs: number;
  itemsPacked: {
    id: string;
    name: string;
    quantity: number;
  }[];
  packingEfficiencyPercent: number;
}

export interface CarrierRate {
  id: string;
  carrier: CarrierCode;
  service: string;
  serviceCode: string;
  description: string;
  baseRate: number; // in dollars (e.g. 8.45)
  insuranceFee: number;
  deliveryGuaranteeFee: number;
  discountAmount: number;
  finalCustomerRate: number; // baseRate + insuranceFee + deliveryGuaranteeFee - discountAmount
  estimatedDays: number;
  estimatedDeliveryDate: string; // ISO date string (YYYY-MM-DD)
  guaranteedDelivery: boolean;
  carrierLogoUrl?: string;
  badge?: 'Fastest' | 'Cheapest' | 'Best Value';
}

export interface CloverDiscountMapping {
  discountName: string;
  discountAmountCents: number;
  percentage?: number;
  cloverDiscountPayload: {
    name: string;
    amount: number; // negative cents in Clover POS API
  };
}

export interface DiscountResult {
  isEligible: boolean;
  ruleApplied?: 'threshold' | 'promo_code' | 'none';
  promoCode?: string;
  originalShippingRate: number;
  discountAmount: number;
  finalShippingRate: number;
  explanation: string;
  cloverMapping?: CloverDiscountMapping;
}

export interface RateQuoteRequest {
  fromAddress?: Address; // Optional, defaults to merchant origin
  toAddress: Address;
  items: Item[];
  cartSubtotal: number;
  insuranceRequested?: boolean;
  declaredValue?: number; // total cart value to insure
  deliveryGuaranteeRequested?: boolean;
  promoCode?: string;
}

export interface RateQuoteResponse {
  quoteId: string;
  createdAt: string;
  origin: Address;
  destination: Address;
  parcel: PackedPackage;
  rates: CarrierRate[];
  cheapestRateId: string;
  fastestRateId: string;
  insurance: {
    requested: boolean;
    declaredValue: number;
    fee: number;
  };
  deliveryGuarantee: {
    requested: boolean;
    fee: number;
  };
  discount: {
    applied: boolean;
    rule?: string;
    promoCode?: string;
    savings: number;
  };
}

export type ShipmentStatus =
  | 'label_created'
  | 'ready_for_pickup'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'voided';

export interface TrackingEvent {
  timestamp: string;
  status: ShipmentStatus;
  statusDetails: string;
  location: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  cloverOrderId?: string;
  cloverPaymentId?: string;
  merchantId?: string;
  carrier: CarrierCode;
  service: string;
  serviceCode: string;
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
  labelFormat: 'PDF' | 'PNG' | 'SVG';
  labelData?: string; // base64 or raw SVG data for instant rendering
  status: ShipmentStatus;
  statusDetails: string;
  fromAddress: Address;
  toAddress: Address;
  parcel: PackedPackage;
  shippingCost: number;
  insuranceCost: number;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
  trackingTimeline: TrackingEvent[];
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping';
  discountValue: number; // e.g. 20 for 20%, 5 for $5
  minOrderAmount: number; // e.g. 50 for $50 order minimum
  active: boolean;
  expiresAt?: string;
  usageCount: number;
  merchantId?: string;
}

export type PlanTier = 'pay_as_you_go' | 'growth' | 'enterprise';

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  monthlyPrice: number;
  includedShipments: number;
  overageRate: number;
  meteredId: string;
  planId: string;
  features: {
    freeShippingThreshold: boolean;
    customMarkup: boolean;
    customCarrierAccounts: boolean;
    priorityTracking: boolean;
  };
}

export interface MerchantSettings {
  merchantId?: string;
  merchantName: string;
  planTier: PlanTier;
  billingCycleMonth?: string;
  shipmentsCountThisMonth?: number;
  originAddress: Address;
  easyPostApiKey?: string;
  cloverApiToken?: string;
  useMockCarrier: boolean;
  enabledCarriers: {
    USPS: boolean;
    UPS: boolean;
    FedEx: boolean;
  };
  defaultCarrier: CarrierCode;
  defaultService: string;
  freeShippingThreshold: number; // in dollars (e.g. 100 for orders >= $100)
  enableFreeShippingThreshold: boolean;
  insuranceRatePerHundred: number; // e.g. 1.05 per $100
  deliveryGuaranteeFee: number; // e.g. 2.99
  markupPercentage: number; // e.g. 0 for none, 10 for 10% handling markup
  defaultPrinterIp?: string;
  defaultPrinterPort?: number;
  defaultPrinterFormat?: ThermalPrintFormat;
}

export interface CloverWebhookPayload {
  appId: string;
  merchants: {
    [merchantId: string]: Array<{
      objectId: string;
      type: 'orders' | 'payments' | 'line_items';
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      ts: number;
    }>;
  };
}

export interface CloverOrder {
  id: string;
  currency: string;
  total: number; // in cents
  state: 'open' | 'locked' | 'paid' | 'manually_closed';
  lineItems?: Array<{
    id: string;
    name: string;
    price: number; // in cents
    unitQty?: number;
    sku?: string;
  }>;
  discounts?: Array<{
    id: string;
    name: string;
    amount: number;
    percentage?: number;
  }>;
  shippingAddress?: Address;
  note?: string;
}

export type ThermalPrintFormat = 'ZPL' | 'ESCPOS';
export type ReceiptPaperWidth = '80mm' | '58mm';
export type ThermalPrinterModel = 'zebra' | 'rollo' | 'brother' | 'dymo' | 'clover' | 'generic';

export interface PrinterPreset {
  id: string;
  name: string;
  brand: string;
  model: string;
  defaultPort: number;
  supportedFormats: ThermalPrintFormat[];
  defaultDpi: number;
  paperSizes: string[];
  description: string;
}

export interface PrintJobRequest {
  shipmentId: string;
  printerIp: string;
  printerPort?: number;
  format?: ThermalPrintFormat;
  paperWidth?: ReceiptPaperWidth;
  copies?: number;
}

export interface PrintJobResult {
  success: boolean;
  jobId: string;
  shipmentId: string;
  trackingNumber: string;
  format: ThermalPrintFormat;
  bytesSent: number;
  printerIp: string;
  printerPort: number;
  message: string;
  timestamp: string;
}

export interface PrinterTestRequest {
  printerIp: string;
  printerPort?: number;
  timeoutMs?: number;
}

export interface PrinterTestResult {
  success: boolean;
  ip: string;
  port: number;
  latencyMs?: number;
  error?: string;
}

