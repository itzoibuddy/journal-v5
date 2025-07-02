import { BaseTradingPlatform, PlatformCredentials, PlatformTrade, SyncResult } from './base';
import { AngelOnePlatform } from './angel-one';
import { ZerodhaPlatform } from './zerodha';
import { UpstoxPlatform } from './upstox';
import { GrowwPlatform } from './groww';
import { DhanPlatform } from './dhan';
import { FyersPlatform } from './fyers';
import { SASOnlinePlatform } from './sasonline';
import { FivePaisaPlatform } from './5paisa';
import { ICICIDirectPlatform } from './icici-direct';

export type SupportedPlatform =
  | 'ANGEL_ONE'
  | 'ZERODHA'
  | 'UPSTOX'
  | '5PAISA'
  | 'ICICI_DIRECT'
  | 'GROWW'
  | 'DHAN'
  | 'FYERS'
  | 'SAS_ONLINE';

class GenericStubPlatform extends BaseTradingPlatform {
  constructor(credentials: PlatformCredentials) {
    super({ baseUrl: '', timeout: 0 }, credentials);
  }
  async authenticate() { return true; }
  async getTrades() { return [] as PlatformTrade[]; }
  async getTradeHistory() { return [] as PlatformTrade[]; }
  async getAccountInfo() { return {}; }
  async refreshToken() { return true; }
  protected async makeRequest() { throw new Error('Not implemented'); }
}

export class TradingPlatformFactory {
  static createPlatform(platform: SupportedPlatform, credentials: PlatformCredentials): BaseTradingPlatform {
    switch (platform.toUpperCase()) {
      case 'ANGEL_ONE':
        return new AngelOnePlatform(credentials);
      case 'ZERODHA':
        return new ZerodhaPlatform(credentials);
      case 'UPSTOX':
        return new UpstoxPlatform(credentials);
      case 'GROWW':
        return new GrowwPlatform(credentials);
      case 'DHAN':
        return new DhanPlatform(credentials);
      case 'FYERS':
        return new FyersPlatform(credentials);
      case 'SAS_ONLINE':
        return new SASOnlinePlatform(credentials);
      case '5PAISA':
        return new FivePaisaPlatform(credentials);
      case 'ICICI_DIRECT':
        return new ICICIDirectPlatform(credentials);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  static getSupportedPlatforms(): { value: SupportedPlatform; label: string; description: string }[] {
    return [
      { value: 'ANGEL_ONE', label: 'Angel One', description: 'Angel Broking trading platform' },
      { value: 'ZERODHA', label: 'Zerodha', description: 'Zerodha Kite trading platform' },
      { value: 'UPSTOX', label: 'Upstox', description: 'Upstox trading platform' },
      { value: '5PAISA', label: '5paisa', description: '5paisa trading platform' },
      { value: 'ICICI_DIRECT', label: 'ICICI Direct', description: 'ICICI Direct trading platform' },
      { value: 'GROWW', label: 'Groww', description: 'Groww trading platform' },
      { value: 'DHAN', label: 'Dhan', description: 'Dhan trading platform' },
      { value: 'FYERS', label: 'Fyers', description: 'Fyers trading platform' },
      { value: 'SAS_ONLINE', label: 'SAS Online', description: 'SAS Online trading platform' },
    ];
  }

  static getPlatformConfig(platform: SupportedPlatform): {
    requiresApiKey: boolean;
    requiresApiSecret: boolean;
    requiresAccessToken: boolean;
    requiresRefreshToken: boolean;
    requiresRequestToken: boolean;
    requiresTotp: boolean;
    fields: Array<{
      name: string;
      label: string;
      type: 'text' | 'password' | 'number' | 'select';
      required: boolean;
      description?: string;
      options?: Array<{ value: string; label: string }>;
    }>;
  } {
    switch (platform.toUpperCase()) {
      case 'ANGEL_ONE':
        return {
          requiresApiKey: true,
          requiresApiSecret: true,
          requiresAccessToken: false,
          requiresRefreshToken: false,
          requiresRequestToken: false,
          requiresTotp: false,
          fields: [
            { name: 'apiKey', label: 'SmartAPI API Key', type: 'text', required: true, description: 'Your Angel One SmartAPI API key from smartapi.angelbroking.com' },
            { name: 'clientcode', label: 'Client Code', type: 'text', required: true, description: 'Your Angel One client code' },
            { name: 'apiSecret', label: 'PIN', type: 'password', required: true, description: 'Your Angel One trading PIN' },
            { name: 'totp', label: 'TOTP (Required)', type: 'text', required: true, description: 'Time-based One-Time Password. Enable TOTP at smartapi.angelbroking.com/enable-totp' },
            { 
              name: 'state', 
              label: 'State', 
              type: 'select', 
              required: true, 
              description: 'Select the state where your Angel One account is registered',
              options: [
                { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
                { value: 'Arunachal Pradesh', label: 'Arunachal Pradesh' },
                { value: 'Assam', label: 'Assam' },
                { value: 'Bihar', label: 'Bihar' },
                { value: 'Chhattisgarh', label: 'Chhattisgarh' },
                { value: 'Delhi', label: 'Delhi' },
                { value: 'Goa', label: 'Goa' },
                { value: 'Gujarat', label: 'Gujarat' },
                { value: 'Haryana', label: 'Haryana' },
                { value: 'Himachal Pradesh', label: 'Himachal Pradesh' },
                { value: 'Jharkhand', label: 'Jharkhand' },
                { value: 'Karnataka', label: 'Karnataka' },
                { value: 'Kerala', label: 'Kerala' },
                { value: 'Madhya Pradesh', label: 'Madhya Pradesh' },
                { value: 'Maharashtra', label: 'Maharashtra' },
                { value: 'Manipur', label: 'Manipur' },
                { value: 'Meghalaya', label: 'Meghalaya' },
                { value: 'Mizoram', label: 'Mizoram' },
                { value: 'Nagaland', label: 'Nagaland' },
                { value: 'Odisha', label: 'Odisha' },
                { value: 'Punjab', label: 'Punjab' },
                { value: 'Rajasthan', label: 'Rajasthan' },
                { value: 'Sikkim', label: 'Sikkim' },
                { value: 'Tamil Nadu', label: 'Tamil Nadu' },
                { value: 'Telangana', label: 'Telangana' },
                { value: 'Tripura', label: 'Tripura' },
                { value: 'Uttar Pradesh', label: 'Uttar Pradesh' },
                { value: 'Uttarakhand', label: 'Uttarakhand' },
                { value: 'West Bengal', label: 'West Bengal' }
              ]
            },
          ],
        };
      case 'ZERODHA':
        return {
          requiresApiKey: true,
          requiresApiSecret: true,
          requiresAccessToken: false,
          requiresRefreshToken: false,
          requiresRequestToken: true,
          requiresTotp: false,
          fields: [
            { name: 'apiKey', label: 'API Key', type: 'text', required: true, description: 'Your Zerodha API key' },
            { name: 'apiSecret', label: 'API Secret', type: 'password', required: true, description: 'Your Zerodha API secret' },
            { name: 'requestToken', label: 'Request Token', type: 'text', required: true, description: 'Request token from Zerodha login' },
          ],
        };
      case 'UPSTOX':
        return {
          requiresApiKey: false,
          requiresApiSecret: false,
          requiresAccessToken: true,
          requiresRefreshToken: true,
          requiresRequestToken: false,
          requiresTotp: false,
          fields: [], // OAuth-based, no manual fields needed
        };
      case 'GROWW':
        return {
          requiresApiKey: true,
          requiresApiSecret: true,
          requiresAccessToken: false,
          requiresRefreshToken: false,
          requiresRequestToken: false,
          requiresTotp: false,
          fields: [
            { name: 'apiKey', label: 'API Key', type: 'text', required: true, description: 'Your Groww API key' },
            { name: 'apiSecret', label: 'API Secret', type: 'password', required: true, description: 'Your Groww API secret' },
          ],
        };
      case 'DHAN':
        return {
          requiresApiKey: false,
          requiresApiSecret: false,
          requiresAccessToken: true,
          requiresRefreshToken: true,
          requiresRequestToken: false,
          requiresTotp: false,
          fields: [], // OAuth-based, no manual fields needed
        };
      case 'FYERS':
        return {
          requiresApiKey: true,
          requiresApiSecret: true,
          requiresAccessToken: true,
          requiresRefreshToken: false,
          requiresRequestToken: false,
          requiresTotp: false,
          fields: [
            { name: 'apiKey', label: 'API Key', type: 'text', required: true, description: 'Your Fyers API key' },
            { name: 'apiSecret', label: 'API Secret', type: 'password', required: true, description: 'Your Fyers API secret' },
            { name: 'accessToken', label: 'Access Token', type: 'text', required: true, description: 'Your Fyers access token' },
          ],
        };
      case 'SAS_ONLINE':
        return {
          requiresApiKey: true,
          requiresApiSecret: true,
          requiresAccessToken: false,
          requiresRefreshToken: false,
          requiresRequestToken: false,
          requiresTotp: false,
          fields: [
            { name: 'apiKey', label: 'API Key', type: 'text', required: true, description: 'Your SAS Online API key' },
            { name: 'apiSecret', label: 'API Secret', type: 'password', required: true, description: 'Your SAS Online API secret' },
          ],
        };
      case '5PAISA':
        return {
          requiresApiKey: true,
          requiresApiSecret: true,
          requiresAccessToken: false,
          requiresRefreshToken: false,
          requiresRequestToken: false,
          requiresTotp: false,
          fields: [
            { name: 'apiKey', label: 'API Key', type: 'text', required: true, description: 'Your 5paisa API key' },
            { name: 'apiSecret', label: 'API Secret', type: 'password', required: true, description: 'Your 5paisa API secret' },
          ],
        };
      case 'ICICI_DIRECT':
        return {
          requiresApiKey: true,
          requiresApiSecret: true,
          requiresAccessToken: false,
          requiresRefreshToken: false,
          requiresRequestToken: false,
          requiresTotp: false,
          fields: [
            { name: 'apiKey', label: 'API Key', type: 'text', required: true, description: 'Your ICICI Direct API key' },
            { name: 'apiSecret', label: 'API Secret', type: 'password', required: true, description: 'Your ICICI Direct API secret' },
          ],
        };
      default:
        return {
          requiresApiKey: false,
          requiresApiSecret: false,
          requiresAccessToken: false,
          requiresRefreshToken: false,
          requiresRequestToken: false,
          requiresTotp: false,
          fields: [],
        };
    }
  }
} 