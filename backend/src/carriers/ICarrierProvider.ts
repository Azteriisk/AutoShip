import { Address, CarrierCode, CarrierRate, PackedPackage, Shipment, TrackingEvent } from '../types/index.js';

export interface GetRatesParams {
  from: Address;
  to: Address;
  parcel: PackedPackage;
  insuranceValue?: number;
  deliveryGuaranteeRequested?: boolean;
}

export interface BuyLabelParams {
  rateId?: string;
  from: Address;
  to: Address;
  parcel: PackedPackage;
  carrier: CarrierCode;
  service: string;
  serviceCode?: string;
  insuranceValue?: number;
  orderId: string;
  cloverOrderId?: string;
}

export interface ICarrierProvider {
  name: string;
  getRates(params: GetRatesParams): Promise<CarrierRate[]>;
  buyLabel(params: BuyLabelParams): Promise<Shipment>;
  getTracking(trackingCode: string, carrier: CarrierCode): Promise<TrackingEvent[]>;
  voidLabel(shipmentId: string): Promise<boolean>;
}
