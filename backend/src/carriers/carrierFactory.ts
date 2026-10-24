import { ICarrierProvider } from './ICarrierProvider.js';
import { easyPostCarrierProvider } from './EasyPostCarrierProvider.js';
import { db } from '../db/database.js';

export class CarrierFactory {
  public static getProvider(): ICarrierProvider {
    const settings = db.getSettings();
    const apiKey = settings.easyPostApiKey || process.env.EASYPOST_API_KEY || '';
    if (!apiKey) {
      throw new Error(
        'EasyPost API Key is not configured. Please enter your API key in Carrier Settings.'
      );
    }
    return easyPostCarrierProvider;
  }
}
