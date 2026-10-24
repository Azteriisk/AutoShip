import { ICarrierProvider } from './ICarrierProvider.js';
import { easyPostCarrierProvider } from './EasyPostCarrierProvider.js';
import { mockCarrierProvider } from './MockCarrierProvider.js';
import { db } from '../db/database.js';

export class CarrierFactory {
  public static getProvider(): ICarrierProvider {
    const settings = db.getSettings();
    if (settings.useMockCarrier) {
      return mockCarrierProvider;
    }
    const apiKey = settings.easyPostApiKey || process.env.EASYPOST_API_KEY || '';
    if (!apiKey) {
      return mockCarrierProvider;
    }
    return easyPostCarrierProvider;
  }
}
