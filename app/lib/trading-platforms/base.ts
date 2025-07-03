export interface PlatformTrade {
  id: string;
  symbol: string;
  type: 'LONG' | 'SHORT';
  instrumentType: 'STOCK' | 'FUTURES' | 'OPTIONS';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  strikePrice?: number;
  expiryDate?: string;
  optionType?: 'CALL' | 'PUT';
  premium?: number;
  entryDate: string;
  exitDate?: string;
  profitLoss?: number;
  orderId?: string;
  tradeId?: string;
  exchange?: string;
  segment?: string;
  productType?: string;
  orderType?: string;
  status?: string;
  
  // Raw data from the broker platform for reference/debugging
  rawData?: any;
}

export interface PlatformCredentials {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  [key: string]: any;
}

export interface SyncResult {
  success: boolean;
  tradesFetched: number;
  tradesCreated: number;
  tradesUpdated: number;
  tradesSkipped: number;
  errors: number;
  errorMessage?: string;
  errorDetails?: any;
  platformTradeIds: string[];
}

export interface PlatformConfig {
  baseUrl: string;
  apiVersion?: string;
  timeout?: number;
  retryAttempts?: number;
}

export abstract class BaseTradingPlatform {
  protected config: PlatformConfig;
  protected credentials: PlatformCredentials;

  constructor(config: PlatformConfig, credentials: PlatformCredentials) {
    this.config = config;
    this.credentials = credentials;
  }

  abstract authenticate(): Promise<boolean>;
  abstract getTrades(startDate?: Date, endDate?: Date): Promise<PlatformTrade[]>;
  abstract getTradeHistory(symbol?: string, startDate?: Date, endDate?: Date): Promise<PlatformTrade[]>;
  abstract getAccountInfo(): Promise<any>;
  abstract refreshToken(): Promise<boolean>;
  
  // Public method to get current credentials (for token updates)
  getCredentials(): PlatformCredentials {
    return { ...this.credentials };
  }
  
  protected abstract makeRequest(endpoint: string, method: string, data?: any): Promise<any>;

  // Helper method to extract option details from symbol
  protected parseOptionDetails(symbol: string): { 
    strikePrice?: number, 
    expiryDate?: string, 
    optionType?: 'CALL' | 'PUT' 
  } {
    try {
      // Import here to avoid circular dependencies
      const { parseOptionsSymbol, isOptionsSymbol } = require('../symbolParser');
      
      if (!symbol || !isOptionsSymbol(symbol)) {
        return {};
      }
      
      const parsed = parseOptionsSymbol(symbol);
      if (parsed.isValid) {
        return {
          strikePrice: parsed.strike,
          expiryDate: parsed.expiry.toISOString(),
          optionType: parsed.optionType === 'CE' || parsed.optionType === 'CALL' ? 'CALL' : 'PUT'
        };
      }
      return {};
    } catch (error) {
      console.error('Error parsing option details:', error);
      return {};
    }
  }

  // Helper method to map instrument type
  protected mapInstrumentType(productType: string): 'STOCK' | 'FUTURES' | 'OPTIONS' {
    const type = (productType || '').toUpperCase();
    if (type.includes('OPT') || type.includes('CE') || type.includes('PE')) {
      return 'OPTIONS';
    }
    if (type.includes('FUT')) {
      return 'FUTURES';
    }
    return 'STOCK';
  }

  async syncTrades(startDate?: Date, endDate?: Date): Promise<SyncResult> {
    try {
      const isAuthenticated = await this.authenticate();
      if (!isAuthenticated) {
        return {
          success: false,
          tradesFetched: 0,
          tradesCreated: 0,
          tradesUpdated: 0,
          tradesSkipped: 0,
          errors: 1,
          errorMessage: 'Authentication failed',
          platformTradeIds: []
        };
      }

      const trades = await this.getTrades(startDate, endDate);
      
      return {
        success: true,
        tradesFetched: trades.length,
        tradesCreated: 0, // Will be set by the sync service
        tradesUpdated: 0, // Will be set by the sync service
        tradesSkipped: 0, // Will be set by the sync service
        errors: 0,
        platformTradeIds: trades.map(t => t.id)
      };
    } catch (error) {
      return {
        success: false,
        tradesFetched: 0,
        tradesCreated: 0,
        tradesUpdated: 0,
        tradesSkipped: 0,
        errors: 1,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
        platformTradeIds: []
      };
    }
  }

  protected async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    throw lastError!;
  }
} 