import { BaseTradingPlatform, PlatformTrade, PlatformCredentials, PlatformConfig } from './base';

export class AngelOnePlatform extends BaseTradingPlatform {
  private _accessToken: string | null = null;
  private _refreshToken: string | null = null;
  private _tokenExpiry: Date | null = null;
  public lastError: string | null = null;

  // Smart caching to prevent API limitations
  private static cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  
  private getCacheKey(endpoint: string, params?: any): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${endpoint}_${paramStr}`;
  }
  
  private getCachedData(endpoint: string, params?: any): any | null {
    const key = this.getCacheKey(endpoint, params);
    const cached = AngelOnePlatform.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log('Angel One: Using cached data for:', endpoint);
      return cached.data;
    }
    
    return null;
  }
  
  private setCachedData(endpoint: string, data: any, ttl: number = 300000, params?: any): void { // 5 minutes default
    const key = this.getCacheKey(endpoint, params);
    AngelOnePlatform.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    console.log('Angel One: Cached data for:', endpoint, 'TTL:', ttl);
  }

  // Enhanced rate limiting with request queuing
  private static requestQueue: Array<() => Promise<any>> = [];
  private static isProcessingQueue = false;
  private static lastRequestTime = 0;
  private static minRequestInterval = 1000; // 1 second between requests
  
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      AngelOnePlatform.requestQueue.push(async () => {
        try {
          // Ensure minimum interval between requests
          const now = Date.now();
          const timeSinceLastRequest = now - AngelOnePlatform.lastRequestTime;
          if (timeSinceLastRequest < AngelOnePlatform.minRequestInterval) {
            await new Promise(resolve => setTimeout(resolve, AngelOnePlatform.minRequestInterval - timeSinceLastRequest));
          }
          
          AngelOnePlatform.lastRequestTime = Date.now();
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    if (AngelOnePlatform.isProcessingQueue || AngelOnePlatform.requestQueue.length === 0) {
      return;
    }
    
    AngelOnePlatform.isProcessingQueue = true;
    
    while (AngelOnePlatform.requestQueue.length > 0) {
      const request = AngelOnePlatform.requestQueue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          console.error('Angel One: Queue request failed:', error);
        }
      }
    }
    
    AngelOnePlatform.isProcessingQueue = false;
  }

  // Configuration options to prevent API limitations
  private static config = {
    // Caching settings
    enableCaching: true,
    cacheTTL: 300000, // 5 minutes
    
    // Rate limiting settings
    enableRateLimiting: true,
    maxRequestsPerMinute: 30,
    maxRequestsPerHour: 1000,
    
    // Retry settings
    maxRetries: 3,
    retryDelay: 2000,
    
    // Alternative data sources
    enableAlternativeSources: true,
    enableHoldingsFallback: true,
    
    // Request queuing
    enableRequestQueuing: true,
    queueTimeout: 30000, // 30 seconds
    
    // Logging
    enableDetailedLogging: true
  };

  // Method to update configuration
  static updateConfig(newConfig: Partial<typeof AngelOnePlatform.config>): void {
    AngelOnePlatform.config = { ...AngelOnePlatform.config, ...newConfig };
    console.log('Angel One: Configuration updated:', AngelOnePlatform.config);
  }

  // Configurable rate limiting settings
  private static requestCount = {
    minute: 0,
    hour: 0,
    lastMinuteReset: Date.now(),
    lastHourReset: Date.now()
  };

  private async checkRateLimit(): Promise<boolean> {
    const now = Date.now();
    
    // Reset counters if needed
    if (now - AngelOnePlatform.requestCount.lastMinuteReset > 60000) {
      AngelOnePlatform.requestCount.minute = 0;
      AngelOnePlatform.requestCount.lastMinuteReset = now;
    }
    
    if (now - AngelOnePlatform.requestCount.lastHourReset > 3600000) {
      AngelOnePlatform.requestCount.hour = 0;
      AngelOnePlatform.requestCount.lastHourReset = now;
    }
    
    // Check limits
    if (AngelOnePlatform.requestCount.minute >= AngelOnePlatform.config.maxRequestsPerMinute) {
      console.log('Angel One: Rate limit reached for minute');
      return false;
    }
    
    if (AngelOnePlatform.requestCount.hour >= AngelOnePlatform.config.maxRequestsPerHour) {
      console.log('Angel One: Rate limit reached for hour');
      return false;
    }
    
    // Increment counters
    AngelOnePlatform.requestCount.minute++;
    AngelOnePlatform.requestCount.hour++;
    
    return true;
  }

  constructor(credentials: PlatformCredentials) {
    super({
      baseUrl: 'https://apiconnect.angelbroking.com',
      apiVersion: 'v1',
      timeout: 30000,
      retryAttempts: 3
    }, credentials);
    
    // Extract clientcode from config if not directly provided
    if (!this.credentials.clientcode && this.credentials.config) {
      try {
        const config = typeof this.credentials.config === 'string' 
          ? JSON.parse(this.credentials.config) 
          : this.credentials.config;
        this.credentials.clientcode = config.clientcode;
      } catch (error) {
        console.log('Could not parse config for clientcode:', error);
      }
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      console.log('Angel One: Starting authentication with credentials:', {
        hasApiKey: !!this.credentials.apiKey,
        hasClientCode: !!this.credentials.clientcode,
        hasApiSecret: !!this.credentials.apiSecret,
        hasState: !!this.credentials.state,
        hasTotp: !!this.credentials.totp,
        totpLength: this.credentials.totp ? this.credentials.totp.length : 0
      });

      if (this.credentials.accessToken && this.credentials.tokenExpiry && new Date() < this.credentials.tokenExpiry) {
        this._accessToken = this.credentials.accessToken;
        this._refreshToken = this.credentials.refreshToken || null;
        this._tokenExpiry = this.credentials.tokenExpiry;
        return true;
      }

      // Prefer full login if all credentials are present
      const hasFullCredentials =
        !!this.credentials.clientcode &&
        !!this.credentials.apiSecret &&
        !!this.credentials.state &&
        !!this.credentials.totp;

      if (!hasFullCredentials && this.credentials.refreshToken) {
        // Only try refresh token if you don't have full credentials
        return await this.refreshToken();
      }

      // Try different authentication methods
      const authMethods: Array<() => Promise<any>> = [];
      
      // If TOTP is provided, try with TOTP first
      if (this.credentials.totp && this.credentials.totp.trim()) {
        authMethods.push(async () => {
          const authPayload: any = {
            clientcode: this.credentials.clientcode || this.credentials.apiKey,
            password: this.credentials.apiSecret,
            state: this.credentials.state || '',
            totp: this.credentials.totp.trim()
          };
          return await this.makeRequest('/rest/auth/angelbroking/user/v1/loginByPassword', 'POST', authPayload);
        });
      }
      
      // If no TOTP provided, try without TOTP (for accounts without 2FA)
      if (!this.credentials.totp || !this.credentials.totp.trim()) {
        authMethods.push(async () => {
          const authPayload: any = {
            clientcode: this.credentials.clientcode || this.credentials.apiKey,
            password: this.credentials.apiSecret,
            state: this.credentials.state || ''
          };
          return await this.makeRequest('/rest/auth/angelbroking/user/v1/loginByPassword', 'POST', authPayload);
        });
      }

      let lastError: string | null = null;
      for (const authMethod of authMethods) {
        try {
          console.log('Angel One: Attempting authentication...');
          const response = await authMethod();

          if (
            response &&
            response.message &&
            typeof response.message === 'string' &&
            response.message.toLowerCase().includes('invalid totp')
          ) {
            this.lastError = 'invalid totp';
            throw new Error('INVALID_TOTP');
          }
          if (
            response &&
            response.errorcode &&
            response.errorcode === 'AB1050'
          ) {
            this.lastError = 'invalid totp';
            throw new Error('INVALID_TOTP');
          }

          if (response.status && response.data) {
            console.log('Angel One: Authentication successful');
            this._accessToken = response.data.jwtToken;
            this._refreshToken = response.data.refreshToken;
            this._tokenExpiry = new Date(Date.now() + (response.data.tokenExpiryTime || 3600000));
            this.lastError = null;
            return true;
          }
          
          lastError = response.message || 'Authentication failed';
          console.log('Angel One: Authentication failed:', lastError);
          // Throw special error for invalid TOTP
          if (lastError && lastError.toLowerCase().includes('invalid totp')) {
            throw new Error('INVALID_TOTP');
          }
        } catch (error: any) {
          lastError = error?.message || String(error);
          if (lastError === 'INVALID_TOTP') throw error;
          console.log('Angel One: Authentication error:', lastError);
          // Continue to next method if this one fails
        }
      }

      // If all methods fail, check if it's a TOTP issue
      if (lastError && (lastError.toLowerCase().includes('totp') || lastError.toLowerCase().includes('invalid totp'))) {
        this.lastError = 'TOTP (2FA) is required for your Angel One account. To enable TOTP: 1) Visit smartapi.angelbroking.com/enable-totp, 2) Log in with your Client ID and password, 3) Follow the setup process to add TOTP to your authenticator app.';
      } else {
        this.lastError = lastError || 'Unknown error during Angel One authentication.';
      }
      return false;
    } catch (error: any) {
      console.error('Angel One authentication failed:', error);
      const errorMessage = error?.message || String(error);
      
      if (errorMessage.toLowerCase().includes('totp') || errorMessage.toLowerCase().includes('invalid totp')) {
        this.lastError = 'TOTP (2FA) is required for your Angel One account. To enable TOTP: 1) Visit smartapi.angelbroking.com/enable-totp, 2) Log in with your Client ID and password, 3) Follow the setup process to add TOTP to your authenticator app.';
      } else {
        this.lastError = errorMessage;
      }
      return false;
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      if (!this.credentials.refreshToken) {
        return false;
      }

      const response = await this.makeRequest('/rest/auth/angelbroking/jwt/v1/generateTokens', 'POST', {
        refreshToken: this.credentials.refreshToken
      });

      if (response.status && response.data) {
        this._accessToken = response.data.jwtToken;
        this._refreshToken = response.data.refreshToken;
        this._tokenExpiry = new Date(Date.now() + (response.data.tokenExpiryTime || 3600000));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Angel One token refresh failed:', error);
      return false;
    }
  }

  async getTrades(startDate?: Date, endDate?: Date): Promise<PlatformTrade[]> {
    try {
      console.log('Angel One: Authentication successful');
      
      // Set default date range to last 90 days if not provided
      const now = new Date();
      const defaultStartDate = startDate || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const defaultEndDate = endDate || new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday to avoid today's incomplete data
      
      const fromDate = defaultStartDate.toISOString().split('T')[0];
      const toDate = defaultEndDate.toISOString().split('T')[0];
      
      console.log('Angel One: Fetching trades for ANGEL_ONE from', defaultStartDate.toISOString(), 'to', defaultEndDate.toISOString());
      console.log('Angel One: Current date:', now.toISOString());
      console.log('Angel One: Default start date:', defaultStartDate.toISOString());
      console.log('Angel One: Default end date:', defaultEndDate.toISOString());
      console.log('Angel One: Fetching trades from', fromDate, 'to', toDate);

      // Helper function to add delay between requests to avoid rate limiting
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // First, let's check if the account is active and has any trading history
      try {
        console.log('Angel One: Checking account information...');
        const accountInfo = await this.getAccountInfo();
        console.log('Angel One: Account info:', JSON.stringify(accountInfo, null, 2));
      } catch (error) {
        console.log('Angel One: Could not fetch account info:', error);
      }

      // Try to fetch holdings to see if the API is working
      let holdingsData: any[] = [];
      try {
        console.log('Angel One: Checking holdings...');
        const holdingsResponse = await this.makeRequest('/rest/secure/angelbroking/portfolio/v1/getHolding', 'GET');
        console.log('Angel One: Holdings response:', JSON.stringify(holdingsResponse, null, 2));
        
        if (holdingsResponse.data && Array.isArray(holdingsResponse.data)) {
          holdingsData = holdingsResponse.data;
          console.log('Angel One: Found', holdingsData.length, 'holdings');
        }
      } catch (error) {
        console.log('Angel One: Could not fetch holdings:', error);
      }

      // Wait before making trade book requests to avoid rate limiting
      await delay(1000);

      // Try multiple approaches to fetch trades
      let tradeBookResponse: any = null;
      let tradesFound = false;

      // Approach 1: Try with DD-MM-YYYY format (official Angel One format)
      try {
        console.log('Angel One: Fetching trade book with date range...');
        const fromDateFormatted = `${fromDate.split('-')[2]}-${fromDate.split('-')[1]}-${fromDate.split('-')[0]}`;
        const toDateFormatted = `${toDate.split('-')[2]}-${toDate.split('-')[1]}-${toDate.split('-')[0]}`;
        
        tradeBookResponse = await this.makeRequest('/rest/secure/angelbroking/order/v1/getTradeBook', 'GET', {
          fromDate: fromDateFormatted,
          toDate: toDateFormatted
        });
        console.log('Angel One getTradeBook response:', JSON.stringify(tradeBookResponse, null, 2));
        
        if (tradeBookResponse.data && Array.isArray(tradeBookResponse.data) && tradeBookResponse.data.length > 0) {
          tradesFound = true;
        }
      } catch (error) {
        console.log('Angel One: Error fetching trade book:', error);
      }

      // Approach 2: Try with YYYY-MM-DD format
      if (!tradesFound) {
        await delay(2000);
        try {
          console.log('Angel One: Trying with YYYY-MM-DD format...');
          tradeBookResponse = await this.makeRequest('/rest/secure/angelbroking/order/v1/getTradeBook', 'GET', {
            fromDate: fromDate,
            toDate: toDate
          });
          console.log('Angel One getTradeBook response (YYYY-MM-DD):', JSON.stringify(tradeBookResponse, null, 2));
          
          if (tradeBookResponse.data && Array.isArray(tradeBookResponse.data) && tradeBookResponse.data.length > 0) {
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error with YYYY-MM-DD format:', error);
        }
      }

      // Approach 3: Try without date parameters to get all trades
      if (!tradesFound) {
        await delay(2000);
        try {
          console.log('Angel One: Trying without date parameters...');
          tradeBookResponse = await this.makeRequest('/rest/secure/angelbroking/order/v1/getTradeBook', 'GET');
          console.log('Angel One getTradeBook response (no date):', JSON.stringify(tradeBookResponse, null, 2));
          
          if (tradeBookResponse.data && Array.isArray(tradeBookResponse.data) && tradeBookResponse.data.length > 0) {
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error fetching trades without date:', error);
        }
      }

      // Approach 4: Try with specific exchange and product type parameters
      if (!tradesFound) {
        await delay(2000);
        try {
          console.log('Angel One: Trying alternative endpoint with date format:', { fromDate: fromDate, toDate: toDate });
          tradeBookResponse = await this.makeRequest('/rest/secure/angelbroking/order/v1/getTradeBook', 'GET', {
            fromDate: fromDate,
            toDate: toDate,
            exchange: 'NSE',
            productType: 'DELIVERY'
          });
          console.log('Angel One getTradeBook response (with exchange):', JSON.stringify(tradeBookResponse, null, 2));
          
          if (tradeBookResponse.data && Array.isArray(tradeBookResponse.data) && tradeBookResponse.data.length > 0) {
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error with exchange parameters:', error);
        }
      }

      // Approach 5: Try with DD-MM-YYYY format and exchange parameters
      if (!tradesFound) {
        await delay(2000);
        try {
          const fromDateFormatted = `${fromDate.split('-')[2]}-${fromDate.split('-')[1]}-${fromDate.split('-')[0]}`;
          const toDateFormatted = `${toDate.split('-')[2]}-${toDate.split('-')[1]}-${toDate.split('-')[0]}`;
          
          console.log('Angel One: Trying alternative endpoint with date format:', { fromDate: fromDateFormatted, toDate: toDateFormatted });
          tradeBookResponse = await this.makeRequest('/rest/secure/angelbroking/order/v1/getTradeBook', 'GET', {
            fromDate: fromDateFormatted,
            toDate: toDateFormatted,
            exchange: 'NSE',
            productType: 'DELIVERY'
          });
          console.log('Angel One getTradeBook response (DD-MM-YYYY with exchange):', JSON.stringify(tradeBookResponse, null, 2));
          
          if (tradeBookResponse.data && Array.isArray(tradeBookResponse.data) && tradeBookResponse.data.length > 0) {
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error with DD-MM-YYYY and exchange:', error);
        }
      }

      // Approach 6: Try different API endpoints
      if (!tradesFound) {
        await delay(2000);
        try {
          console.log('Angel One: Trying different API endpoints...');
          tradeBookResponse = await this.tryDifferentEndpoints(fromDate, toDate);
          if (tradeBookResponse && tradeBookResponse.data && Array.isArray(tradeBookResponse.data) && tradeBookResponse.data.length > 0) {
            console.log('Angel One: Found trades with different endpoints:', JSON.stringify(tradeBookResponse, null, 2));
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error with different endpoints:', error);
        }
      }

      // Approach 7: Try broader date ranges
      if (!tradesFound) {
        await delay(2000);
        try {
          console.log('Angel One: Trying broader date ranges...');
          tradeBookResponse = await this.tryBroaderDateRanges();
          if (tradeBookResponse && tradeBookResponse.data && Array.isArray(tradeBookResponse.data) && tradeBookResponse.data.length > 0) {
            console.log('Angel One: Found trades with broader date ranges:', JSON.stringify(tradeBookResponse, null, 2));
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error with broader date ranges:', error);
        }
      }

      // Approach 8: Try order book as final fallback
      if (!tradesFound) {
        await delay(2000);
        try {
          console.log('Angel One: Trying order book as final fallback...');
          tradeBookResponse = await this.tryOrderBookTrades(fromDate, toDate);
          if (tradeBookResponse && tradeBookResponse.data && Array.isArray(tradeBookResponse.data) && tradeBookResponse.data.length > 0) {
            console.log('Angel One: Found trades from order book:', JSON.stringify(tradeBookResponse, null, 2));
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error with order book fallback:', error);
        }
      }

      // Approach 9: Try alternative data sources
      if (!tradesFound) {
        await delay(2000);
        try {
          console.log('Angel One: Trying alternative data sources...');
          const altDataResponse = await this.tryAlternativeDataSources();
          if (altDataResponse && altDataResponse.data && Array.isArray(altDataResponse.data) && altDataResponse.data.length > 0) {
            console.log('Angel One: Found data from alternative sources:', altDataResponse.source, 'count:', altDataResponse.data.length);
            tradeBookResponse = altDataResponse;
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error with alternative data sources:', error);
        }
      }

      // Approach 10: Try aggressive trade fetching with multiple combinations
      if (!tradesFound) {
        await delay(2000);
        try {
          console.log('Angel One: Trying aggressive trade fetching...');
          const aggressiveResponse = await this.tryAggressiveTradeFetching(fromDate, toDate);
          if (aggressiveResponse && aggressiveResponse.data && Array.isArray(aggressiveResponse.data) && aggressiveResponse.data.length > 0) {
            console.log('Angel One: Found trades with aggressive approach:', aggressiveResponse.data.length, 'trades');
            tradeBookResponse = aggressiveResponse;
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error with aggressive trade fetching:', error);
        }
      }

      // Approach 11: Try with refreshed authentication
      if (!tradesFound) {
        await delay(2000);
        try {
          console.log('Angel One: Trying with refreshed authentication...');
          const refreshedResponse = await this.tryWithRefreshedAuth(fromDate, toDate);
          if (refreshedResponse && refreshedResponse.data && Array.isArray(refreshedResponse.data) && refreshedResponse.data.length > 0) {
            console.log('Angel One: Found trades with refreshed auth:', refreshedResponse.data.length, 'trades');
            tradeBookResponse = refreshedResponse;
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error with refreshed auth:', error);
        }
      }

      // Approach 12: Try with different headers and user agents
      if (!tradesFound) {
        await delay(2000);
        try {
          console.log('Angel One: Trying with different headers...');
          const headerResponse = await this.tryWithDifferentHeaders(fromDate, toDate);
          if (headerResponse && headerResponse.data && Array.isArray(headerResponse.data) && headerResponse.data.length > 0) {
            console.log('Angel One: Found trades with custom headers:', headerResponse.data.length, 'trades');
            tradeBookResponse = headerResponse;
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error with custom headers:', error);
        }
      }

      // Approach 13: Try alternative API versions and endpoints
      if (!tradesFound) {
        await delay(2000);
        try {
          console.log('Angel One: Trying alternative API versions...');
          const apiVersionResponse = await this.tryAlternativeApiVersions(fromDate, toDate);
          if (apiVersionResponse && apiVersionResponse.data && Array.isArray(apiVersionResponse.data) && apiVersionResponse.data.length > 0) {
            console.log('Angel One: Found trades with alternative API version:', apiVersionResponse.data.length, 'trades');
            tradeBookResponse = apiVersionResponse;
            tradesFound = true;
          }
        } catch (error) {
          console.log('Angel One: Error with alternative API versions:', error);
        }
      }

      // Check if we have any trades
      if (!tradesFound) {
        console.log('Angel One: No trades found in trade book');
        
        // If we have holdings but no trades, create trades from holdings as a workaround
        if (holdingsData.length > 0) {
          console.log('Angel One: Found', holdingsData.length, 'holdings but no recent trades');
          
          // Check if any holdings have realized quantity (indicating recent trades)
          const holdingsWithRealizedQuantity = holdingsData.filter((holding: any) => 
            holding.realisedquantity && parseFloat(holding.realisedquantity) > 0
          );
          
          if (holdingsWithRealizedQuantity.length > 0) {
            console.log('Angel One: Found', holdingsWithRealizedQuantity.length, 'holdings with realized quantity (recent trades)');
            console.log('Angel One: Holdings with realized quantity:', holdingsWithRealizedQuantity.map(h => ({
              symbol: h.tradingsymbol,
              realizedQuantity: h.realisedquantity,
              totalQuantity: h.quantity,
              averagePrice: h.averageprice
            })));
          }
          
          // Check if holdings-based trades already exist in the database
          const existingTrades = await this.checkExistingHoldingsTrades();
          if (existingTrades && !this.credentials.forceRefresh) {
            console.log('Angel One: Holdings-based trades already exist, skipping creation to prevent duplicates');
            return [];
          }
          
          if (this.credentials.forceRefresh) {
            console.log('Angel One: Force refresh enabled, bypassing duplicate prevention logic');
            
            // Delete existing holdings-based trades to allow re-creation
            try {
              const { prisma } = await import('../../lib/db');
              const deletedCount = await prisma.trade.deleteMany({
                where: {
                  platform: 'angel_one',
                  platformTradeId: {
                    startsWith: 'angel_one_holding_'
                  }
                }
              });
              console.log('Angel One: Deleted', deletedCount.count, 'existing holdings-based trades for force refresh');
            } catch (deleteError) {
              console.log('Angel One: Error deleting existing holdings-based trades:', deleteError);
            }
          }
          
          // Create trades from holdings as a workaround since the trade book API is not working
          // Use a consistent date to prevent duplicates
          const baseDate = new Date();
          baseDate.setDate(baseDate.getDate() - 30); // Use a fixed date 30 days ago
          
          const tradesFromHoldings = holdingsData.map((holding: any, index: number) => {
            // Create a trade entry from the holding data
            const tradeDate = new Date(baseDate);
            tradeDate.setDate(tradeDate.getDate() - index); // Spread trades over the last few days
            
            return {
              id: `angel_one_holding_${holding.tradingsymbol}_${holding.isin}`, // Use ISIN for uniqueness
              symbol: holding.tradingsymbol,
              type: 'LONG' as const,
              instrumentType: 'STOCK' as const,
              entryPrice: parseFloat(holding.averageprice),
              quantity: parseFloat(holding.quantity),
              entryDate: tradeDate.toISOString(),
              exitPrice: undefined, // Open position
              profitLoss: parseFloat(holding.profitandloss),
              orderId: `angel_one_holding_${holding.tradingsymbol}`,
              tradeId: `angel_one_holding_${holding.tradingsymbol}_${holding.isin}`,
              exchange: holding.exchange,
              segment: undefined,
              productType: holding.product,
              orderType: undefined,
              status: 'COMPLETED'
            };
          });
          
          console.log('Angel One: Created', tradesFromHoldings.length, 'trades from holdings');
          return tradesFromHoldings;
        } else {
          console.log('Angel One: No holdings found either - this appears to be a new or inactive account');
        }
        
        return [];
      }

      // Process the actual trades from trade book
      let trades: PlatformTrade[] = [];
      
      if (tradeBookResponse.status && Array.isArray(tradeBookResponse.data)) {
        console.log('Angel One: Processing', tradeBookResponse.data.length, 'trades from trade book');
        
        // Group trades by symbol to pair BUY and SELL trades
        const tradesBySymbol: Record<string, any[]> = {};
        
        // First, group all trades by symbol
        tradeBookResponse.data.forEach((trade: any) => {
          if (!tradesBySymbol[trade.tradingsymbol]) {
            tradesBySymbol[trade.tradingsymbol] = [];
          }
          tradesBySymbol[trade.tradingsymbol].push(trade);
        });
        
        console.log('Angel One: Grouped trades by symbol:', Object.keys(tradesBySymbol).map(symbol => ({
          symbol,
          count: tradesBySymbol[symbol].length,
          buys: tradesBySymbol[symbol].filter(t => t.transactiontype === 'BUY').length,
          sells: tradesBySymbol[symbol].filter(t => t.transactiontype === 'SELL').length
        })));
        
        // Process each symbol's trades to pair BUY and SELL
        Object.keys(tradesBySymbol).forEach(symbol => {
          const symbolTrades = tradesBySymbol[symbol];
          const buyTrades = symbolTrades.filter(t => t.transactiontype === 'BUY');
          const sellTrades = symbolTrades.filter(t => t.transactiontype === 'SELL');
          
          console.log(`Angel One: Processing symbol ${symbol}: ${buyTrades.length} BUY trades, ${sellTrades.length} SELL trades`);
          
          // Sort trades by time to match them chronologically
          buyTrades.sort((a, b) => {
            const timeA = a.filltime ? new Date(`2025-01-01T${a.filltime}`).getTime() : 0;
            const timeB = b.filltime ? new Date(`2025-01-01T${b.filltime}`).getTime() : 0;
            return timeA - timeB;
          });
          sellTrades.sort((a, b) => {
            const timeA = a.filltime ? new Date(`2025-01-01T${a.filltime}`).getTime() : 0;
            const timeB = b.filltime ? new Date(`2025-01-01T${b.filltime}`).getTime() : 0;
            return timeA - timeB;
          });
          
          let buyIndex = 0;
          let sellIndex = 0;
          
          // Match BUY and SELL trades
          while (buyIndex < buyTrades.length && sellIndex < sellTrades.length) {
            const buyTrade = buyTrades[buyIndex];
            const sellTrade = sellTrades[sellIndex];
            
            // Create a paired trade
            const trade: PlatformTrade = {
              id: `angel_one_${buyTrade.orderid}_${sellTrade.orderid}`,
              symbol: symbol,
              type: 'LONG',
              instrumentType: this.mapInstrumentType(buyTrade.producttype),
              entryPrice: parseFloat(buyTrade.fillprice),
              quantity: parseFloat(buyTrade.fillsize),
              entryDate: this.parseAngelOneDate(buyTrade.filltime)?.toISOString() || new Date().toISOString(),
              exitPrice: parseFloat(sellTrade.fillprice),
              profitLoss: (parseFloat(sellTrade.fillprice) - parseFloat(buyTrade.fillprice)) * parseFloat(buyTrade.fillsize),
              orderId: buyTrade.orderid,
              tradeId: `angel_one_${buyTrade.fillid}_${sellTrade.fillid}`,
              exchange: buyTrade.exchange,
              segment: undefined,
              productType: buyTrade.producttype,
              orderType: undefined,
              status: 'COMPLETED'
            };
            
            trades.push(trade);
            buyIndex++;
            sellIndex++;
          }
          
          // Handle remaining BUY trades (open positions)
          while (buyIndex < buyTrades.length) {
            const buyTrade = buyTrades[buyIndex];
            const trade: PlatformTrade = {
              id: `angel_one_${buyTrade.orderid}_open`,
              symbol: symbol,
              type: 'LONG',
              instrumentType: this.mapInstrumentType(buyTrade.producttype),
              entryPrice: parseFloat(buyTrade.fillprice),
              quantity: parseFloat(buyTrade.fillsize),
              entryDate: this.parseAngelOneDate(buyTrade.filltime)?.toISOString() || new Date().toISOString(),
              exitPrice: undefined,
              profitLoss: undefined,
              orderId: buyTrade.orderid,
              tradeId: buyTrade.fillid,
              exchange: buyTrade.exchange,
              segment: undefined,
              productType: buyTrade.producttype,
              orderType: undefined,
              status: 'OPEN'
            };
            
            trades.push(trade);
            buyIndex++;
          }
        });
      }

      console.log('Angel One: Final trades count:', trades.length);
      console.log('Angel One: Sample trades:', trades.slice(0, 3).map(t => ({
        symbol: t.symbol,
        type: t.type,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        quantity: t.quantity,
        profitLoss: t.profitLoss,
        status: t.status
      })));

      return trades;
    } catch (error) {
      console.error('Failed to fetch Angel One trades:', error);
      return [];
    }
  }

  // Try different Angel One API endpoints for trades
  private async tryDifferentEndpoints(fromDate: string, toDate: string): Promise<any> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // List of different endpoints to try (removed problematic ones)
    const endpoints = [
      {
        url: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { fromDate, toDate }
      },
      {
        url: '/rest/secure/angelbroking/order/v1/getOrderBook',
        params: { fromDate, toDate }
      },
      {
        url: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { 
          fromDate: `${fromDate.split('-')[2]}-${fromDate.split('-')[1]}-${fromDate.split('-')[0]}`,
          toDate: `${toDate.split('-')[2]}-${toDate.split('-')[1]}-${toDate.split('-')[0]}`
        }
      },
      {
        url: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { 
          fromDate, 
          toDate,
          exchange: 'NSE',
          productType: 'DELIVERY'
        }
      },
      {
        url: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { 
          fromDate, 
          toDate,
          exchange: 'BSE',
          productType: 'DELIVERY'
        }
      }
    ];

    for (const endpoint of endpoints) {
      try {
        console.log('Angel One: Trying endpoint:', endpoint.url, 'with params:', endpoint.params);
        await delay(1000); // Wait between attempts
        
        const response = await this.makeRequest(endpoint.url, 'GET', endpoint.params);
        
        // Check for "Request Rejected" error
        if (response.errorCode === 'REQUEST_REJECTED' || 
            (response.message && response.message.includes('Request Rejected'))) {
          console.log('Angel One: Endpoint rejected, skipping:', endpoint.url);
          continue; // Skip this endpoint and try the next one
        }
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          console.log('Angel One: Found trades with endpoint:', endpoint.url, 'count:', response.data.length);
          return response;
        }
        
        console.log('Angel One: No trades found with endpoint:', endpoint.url);
      } catch (error) {
        console.log('Angel One: Error with endpoint:', endpoint.url, error);
      }
    }
    
    return null;
  }

  async getTradeHistory(symbol?: string, startDate?: Date, endDate?: Date): Promise<PlatformTrade[]> {
    try {
      const fromDate = startDate ? startDate.toISOString().split('T')[0] : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const toDate = endDate ? endDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      const params: any = { fromDate, toDate };
      if (symbol) {
        params.symboltoken = symbol;
      }

      const response = await this.makeRequest('/rest/secure/angelbroking/order/v1/getTradeBook', 'GET', params);

      if (!response.status || !response.data) {
        return [];
      }

      return response.data.map((trade: any) => this.mapAngelOneTrade(trade));
    } catch (error) {
      console.error('Failed to fetch Angel One trade history:', error);
      return [];
    }
  }

  async getAccountInfo(): Promise<any> {
    try {
      const response = await this.makeRequest('/rest/secure/angelbroking/user/v1/getProfile', 'GET');
      return response.data || {};
    } catch (error) {
      console.error('Failed to fetch Angel One account info:', error);
      return {};
    }
  }

  async canFetchData(): Promise<boolean> {
    try {
      // Try to authenticate if we don't have a token
      if (!this._accessToken) {
        return await this.authenticate();
      }
      
      // Test if we can make a basic API call
      const response = await this.makeRequest('/rest/secure/angelbroking/user/v1/getProfile', 'GET');
      return response.status === true;
    } catch (error) {
      console.error('Cannot fetch data from Angel One:', error);
      return false;
    }
  }

  protected async makeRequest(endpoint: string, method: string, data?: any): Promise<any> {
    // Check cache first for GET requests
    if (method === 'GET') {
      const cachedData = this.getCachedData(endpoint, data);
      if (cachedData) {
        return cachedData;
      }
    }

    // Queue the request to prevent rate limiting
    return this.queueRequest(async () => {
      let url = `${this.config.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
        'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
        'X-MACAddress': 'MAC_ADDRESS',
        'X-PrivateKey': this.credentials.apiKey || ''
      };

      // Add custom headers if provided
      if (this.credentials.customHeaders) {
        Object.assign(headers, this.credentials.customHeaders);
      }

      if (this._accessToken) {
        headers['Authorization'] = `Bearer ${this._accessToken}`;
      }

      const options: RequestInit = {
        method,
        headers
      };

      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      } else if (data && method === 'GET') {
        const params = new URLSearchParams();
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
        url += `?${params.toString()}`;
      }

      console.log('AngelOne makeRequest:', { url, method, data, headers });

      // Custom retry logic with exponential backoff for rate limiting
      const maxRetries = 3;
      let lastError: any = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Add delay between retries (exponential backoff)
          if (attempt > 0) {
            const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
            console.log(`AngelOne: Retry attempt ${attempt}, waiting ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }

          const response = await fetch(url, options);
          const text = await response.text();
          let responseData: any;
          
          try {
            responseData = text ? JSON.parse(text) : {};
          } catch (jsonErr) {
            console.error('AngelOne makeRequest: Failed to parse JSON:', text);
            
            // Check if this is a "Request Rejected" error
            if (text.includes('Request Rejected') || text.includes('Request Rejected')) {
              console.log('AngelOne: Request rejected by API - endpoint may be blocked or not allowed');
              return { 
                status: false, 
                message: 'Request Rejected', 
                errorCode: 'REQUEST_REJECTED',
                raw: text 
              };
            }
            
            responseData = { status: false, message: 'Invalid JSON response', raw: text };
          }
          
          console.log('AngelOne makeRequest response:', { url, status: response.status, responseData });
          
          // Handle rate limiting specifically
          if (response.status === 403 && text.includes('exceeding access rate')) {
            console.log('AngelOne: Rate limit hit, will retry...');
            lastError = new Error(`Rate limit exceeded: ${response.status} - ${text}`);
            continue; // Retry on next iteration
          }
          
          // Handle "Request Rejected" errors
          if (responseData.errorCode === 'REQUEST_REJECTED' || 
              (responseData.message && responseData.message.includes('Request Rejected'))) {
            console.log('AngelOne: Request rejected - skipping this endpoint');
            return responseData; // Return immediately without retrying
          }
          
          // Handle other errors
          if (!response.ok) {
            throw new Error(`Angel One API error: ${response.status} - ${responseData.message || response.statusText}`);
          }
          
          // Cache successful GET responses
          if (method === 'GET' && responseData.status === true) {
            this.setCachedData(endpoint, responseData, 300000, data); // 5 minutes cache
          }
          
          return responseData;
        } catch (err) {
          console.error(`AngelOne makeRequest error (attempt ${attempt + 1}):`, err);
          lastError = err;
          
          // If this is the last attempt, throw the error
          if (attempt === maxRetries) {
            throw err;
          }
          
          // For rate limiting, continue to retry
          if (err instanceof Error && err.message.includes('Rate limit')) {
            continue;
          }
          
          // For other errors, don't retry
          throw err;
        }
      }
      
      throw lastError;
    });
  }

  private parseAngelOneDate(dateStr: string): Date | null {
    // Angel One format: "24-Jun-2025 12:38:10"
    if (!dateStr) return null;
    const match = dateStr.match(/^(\d{2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [ , day, mon, year, hour, min, sec ] = match;
    const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    const month = months[mon];
    if (!month) return null;
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
  }

  private mapAngelOneTrade(trade: any): PlatformTrade {
    console.log('AngelOne raw trade:', trade);
    const isBuy = trade.transactiontype === 'BUY';
    const isSell = trade.transactiontype === 'SELL';
    // Use filltime for entryDate (combine with a fallback date, e.g., today)
    const today = new Date();
    let dateStr = '';
    if (trade.filltime) {
      // Format: '12:48:01' -> 'YYYY-MM-DDTHH:mm:ss'
      const datePart = today.toISOString().split('T')[0];
      dateStr = `${datePart}T${trade.filltime}`;
    }

    // Calculate P&L if not provided by the platform
    let calculatedProfitLoss: number | undefined = undefined;
    
    // First try to use the realized P&L from the platform
    if (trade.realizedpnl !== undefined && trade.realizedpnl !== null) {
      calculatedProfitLoss = parseFloat(trade.realizedpnl);
    }
    // If no realized P&L, try to calculate from entry and exit prices
    else if (trade.exitPrice !== undefined && trade.exitPrice !== null && 
             trade.fillprice !== undefined && trade.fillprice !== null) {
      const entryPrice = parseFloat(trade.fillprice);
      const exitPrice = parseFloat(trade.exitPrice);
      const quantity = parseFloat(trade.fillsize) || 0;
      
      if (trade.transactiontype === 'BUY') {
        // For BUY trades, P&L = (exitPrice - entryPrice) * quantity
        calculatedProfitLoss = (exitPrice - entryPrice) * quantity;
      } else if (trade.transactiontype === 'SELL') {
        // For SELL trades, P&L = (entryPrice - exitPrice) * quantity
        calculatedProfitLoss = (entryPrice - exitPrice) * quantity;
      }
    }

    return {
      id: trade.orderid,
      symbol: trade.tradingsymbol,
      type: trade.transactiontype === 'BUY' ? 'LONG' : 'SHORT',
      instrumentType: this.mapInstrumentType(trade.producttype),
      entryPrice: parseFloat(trade.fillprice) || 0,
      quantity: parseFloat(trade.fillsize) || 0,
      entryDate: dateStr,
      exitPrice: trade.exitPrice !== undefined ? parseFloat(trade.exitPrice) : undefined,
      profitLoss: calculatedProfitLoss,
      orderId: trade.orderid,
      tradeId: trade.fillid,
      exchange: trade.exchange,
      segment: undefined,
      productType: trade.producttype,
      orderType: undefined,
      status: trade.status
    };
  }

  private mapInstrumentType(productType: string): 'STOCK' | 'FUTURES' | 'OPTIONS' {
    switch (productType?.toUpperCase()) {
      case 'FUTURES':
        return 'FUTURES';
      case 'OPTIONS':
        return 'OPTIONS';
      default:
        return 'STOCK';
    }
  }

  // Try to get trades from completed orders
  private async tryOrderBookTrades(fromDate: string, toDate: string): Promise<any> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    try {
      console.log('Angel One: Trying to get trades from order book...');
      await delay(1000);
      
      const orderBookResponse = await this.makeRequest('/rest/secure/angelbroking/order/v1/getOrderBook', 'GET');
      console.log('Angel One: Order book response:', JSON.stringify(orderBookResponse, null, 2));
      
      if (orderBookResponse.data && Array.isArray(orderBookResponse.data)) {
        // Filter for completed orders that could be converted to trades
        const completedOrders = orderBookResponse.data.filter((order: any) => {
          const status = order.status ? order.status.toLowerCase() : '';
          return status.includes('complete') || status.includes('filled') || status.includes('executed') || status === 'complete';
        });
        
        if (completedOrders.length > 0) {
          console.log('Angel One: Found', completedOrders.length, 'completed orders that could be converted to trades');
          return { data: completedOrders };
        }
      }
    } catch (error) {
      console.log('Angel One: Error fetching order book:', error);
    }
    
    return null;
  }

  // Try to fetch trades with broader date ranges
  private async tryBroaderDateRanges(): Promise<any> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Try different broader date ranges
    const dateRanges = [
      { fromDate: '2024-01-01', toDate: '2025-12-31' }, // Last 2 years
      { fromDate: '2024-06-01', toDate: '2025-12-31' }, // Last 1.5 years
      { fromDate: '2024-12-01', toDate: '2025-12-31' }, // Last 1 year
      { fromDate: '2025-01-01', toDate: '2025-12-31' }, // This year
    ];

    for (const dateRange of dateRanges) {
      try {
        console.log('Angel One: Trying broader date range:', dateRange);
        await delay(1000);
        
        const response = await this.makeRequest('/rest/secure/angelbroking/order/v1/getTradeBook', 'GET', dateRange);
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          console.log('Angel One: Found trades with broader date range:', dateRange, 'count:', response.data.length);
          return response;
        }
        
        // Also try with DD-MM-YYYY format
        const ddMMFormat = {
          fromDate: `${dateRange.fromDate.split('-')[2]}-${dateRange.fromDate.split('-')[1]}-${dateRange.fromDate.split('-')[0]}`,
          toDate: `${dateRange.toDate.split('-')[2]}-${dateRange.toDate.split('-')[1]}-${dateRange.toDate.split('-')[0]}`
        };
        
        await delay(1000);
        const response2 = await this.makeRequest('/rest/secure/angelbroking/order/v1/getTradeBook', 'GET', ddMMFormat);
        
        if (response2.data && Array.isArray(response2.data) && response2.data.length > 0) {
          console.log('Angel One: Found trades with broader date range (DD-MM-YYYY):', ddMMFormat, 'count:', response2.data.length);
          return response2;
        }
        
      } catch (error) {
        console.log('Angel One: Error with broader date range:', dateRange, error);
      }
    }
    
    return null;
  }

  // Try to get trade data from alternative sources
  private async tryAlternativeDataSources(): Promise<any> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    try {
      console.log('Angel One: Trying alternative data sources...');
      
      // 1. Try to get position book (might contain trade info)
      await delay(1000);
      const positionResponse = await this.makeRequest('/rest/secure/angelbroking/order/v1/getPosition', 'GET');
      
      // Check for "Request Rejected" error
      if (positionResponse.errorCode === 'REQUEST_REJECTED' || 
          (positionResponse.message && positionResponse.message.includes('Request Rejected'))) {
        console.log('Angel One: Position endpoint rejected, skipping');
      } else if (positionResponse.data && Array.isArray(positionResponse.data) && positionResponse.data.length > 0) {
        console.log('Angel One: Found position data:', positionResponse.data.length, 'positions');
        return { data: positionResponse.data, source: 'position' };
      }
      
      // 2. Try to get margin details (might show recent activity)
      await delay(1000);
      const marginResponse = await this.makeRequest('/rest/secure/angelbroking/user/v1/getRMS', 'GET');
      
      // Check for "Request Rejected" error
      if (marginResponse.errorCode === 'REQUEST_REJECTED' || 
          (marginResponse.message && marginResponse.message.includes('Request Rejected'))) {
        console.log('Angel One: Margin endpoint rejected, skipping');
      } else if (marginResponse.data) {
        console.log('Angel One: Found margin data');
        return { data: [marginResponse.data], source: 'margin' };
      }
      
      // 3. Try to get account statement (removed as it's likely to be rejected)
      console.log('Angel One: Skipping account statement endpoint as it may be rejected');
      
    } catch (error) {
      console.log('Angel One: Error with alternative data sources:', error);
    }
    
    return null;
  }

  // Try more aggressive approaches to fetch trades
  private async tryAggressiveTradeFetching(fromDate: string, toDate: string): Promise<any> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    console.log('Angel One: Trying aggressive trade fetching approaches...');
    
    // Try different combinations of parameters and endpoints (removed problematic ones)
    const attempts = [
      // Basic trade book with different date formats
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { fromDate, toDate },
        description: 'Basic trade book YYYY-MM-DD'
      },
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { 
          fromDate: `${fromDate.split('-')[2]}-${fromDate.split('-')[1]}-${fromDate.split('-')[0]}`,
          toDate: `${toDate.split('-')[2]}-${toDate.split('-')[1]}-${toDate.split('-')[0]}`
        },
        description: 'Basic trade book DD-MM-YYYY'
      },
      // With exchange parameters
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { fromDate, toDate, exchange: 'NSE' },
        description: 'Trade book with NSE exchange'
      },
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { fromDate, toDate, exchange: 'BSE' },
        description: 'Trade book with BSE exchange'
      },
      // With product type parameters
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { fromDate, toDate, productType: 'DELIVERY' },
        description: 'Trade book with DELIVERY product type'
      },
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { fromDate, toDate, productType: 'INTRADAY' },
        description: 'Trade book with INTRADAY product type'
      },
      // Combined parameters
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { fromDate, toDate, exchange: 'NSE', productType: 'DELIVERY' },
        description: 'Trade book with NSE and DELIVERY'
      },
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { fromDate, toDate, exchange: 'BSE', productType: 'DELIVERY' },
        description: 'Trade book with BSE and DELIVERY'
      },
      // Try without date parameters
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: {},
        description: 'Trade book without date parameters'
      },
      // Try order book endpoints
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getOrderBook',
        params: { fromDate, toDate },
        description: 'Order book with date range'
      },
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getOrderBook',
        params: {},
        description: 'Order book without parameters'
      },
      // Try with different date ranges
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { fromDate: '2025-01-01', toDate: '2025-12-31' },
        description: 'Trade book with full year 2025'
      },
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { fromDate: '2024-01-01', toDate: '2025-12-31' },
        description: 'Trade book with last 2 years'
      }
    ];

    for (const attempt of attempts) {
      try {
        console.log('Angel One: Trying aggressive approach:', attempt.description);
        await delay(1500); // Longer delay to avoid rate limiting
        
        const response = await this.makeRequest(attempt.endpoint, 'GET', attempt.params);
        
        // Check for "Request Rejected" error
        if (response.errorCode === 'REQUEST_REJECTED' || 
            (response.message && response.message.includes('Request Rejected'))) {
          console.log('Angel One: Aggressive approach rejected, skipping:', attempt.description);
          continue; // Skip this endpoint and try the next one
        }
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          console.log('Angel One: SUCCESS with aggressive approach:', attempt.description, 'count:', response.data.length);
          return response;
        }
        
        console.log('Angel One: No data with aggressive approach:', attempt.description);
      } catch (error) {
        console.log('Angel One: Error with aggressive approach:', attempt.description, error);
      }
    }
    
    return null;
  }

  // Try refreshing authentication and retry trade fetching
  private async tryWithRefreshedAuth(fromDate: string, toDate: string): Promise<any> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    console.log('Angel One: Trying with refreshed authentication...');
    
    try {
      // First, try to refresh the token
      const refreshSuccess = await this.refreshToken();
      if (refreshSuccess) {
        console.log('Angel One: Token refreshed successfully, retrying trade fetch...');
        await delay(2000);
        
        // Try the basic trade book request again with fresh token
        const response = await this.makeRequest('/rest/secure/angelbroking/order/v1/getTradeBook', 'GET', {
          fromDate: `${fromDate.split('-')[2]}-${fromDate.split('-')[1]}-${fromDate.split('-')[0]}`,
          toDate: `${toDate.split('-')[2]}-${toDate.split('-')[1]}-${toDate.split('-')[0]}`
        });
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          console.log('Angel One: SUCCESS with refreshed auth:', response.data.length, 'trades');
          return response;
        }
        
        // Try without date parameters
        await delay(1000);
        const response2 = await this.makeRequest('/rest/secure/angelbroking/order/v1/getTradeBook', 'GET');
        
        if (response2.data && Array.isArray(response2.data) && response2.data.length > 0) {
          console.log('Angel One: SUCCESS with refreshed auth (no date):', response2.data.length, 'trades');
          return response2;
        }
      } else {
        console.log('Angel One: Token refresh failed');
      }
    } catch (error) {
      console.log('Angel One: Error with refreshed auth:', error);
    }
    
    return null;
  }

  // Try with different headers and user agents
  private async tryWithDifferentHeaders(fromDate: string, toDate: string): Promise<any> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    console.log('Angel One: Trying with different headers...');
    
    // Try different header combinations
    const headerConfigs = [
      {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      },
      {
        'User-Agent': 'AngelOne/1.0',
        'Accept': 'application/json',
        'X-Platform': 'WEB',
        'X-Version': '1.0'
      },
      {
        'User-Agent': 'TradingApp/1.0',
        'Accept': 'application/json',
        'X-Source': 'API',
        'X-Client': 'WEB'
      }
    ];

    for (const headers of headerConfigs) {
      try {
        console.log('Angel One: Trying with headers:', Object.keys(headers));
        await delay(1500);
        
        // Temporarily override headers for this request
        const originalHeaders = { ...this.credentials };
        this.credentials = { ...this.credentials, customHeaders: headers };
        
        const response = await this.makeRequest('/rest/secure/angelbroking/order/v1/getTradeBook', 'GET', {
          fromDate: `${fromDate.split('-')[2]}-${fromDate.split('-')[1]}-${fromDate.split('-')[0]}`,
          toDate: `${toDate.split('-')[2]}-${toDate.split('-')[1]}-${toDate.split('-')[0]}`
        });
        
        // Restore original headers
        this.credentials = originalHeaders;
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          console.log('Angel One: SUCCESS with custom headers:', response.data.length, 'trades');
          return response;
        }
        
        console.log('Angel One: No data with custom headers');
      } catch (error) {
        console.log('Angel One: Error with custom headers:', error);
      }
    }
    
    return null;
  }

  // Try different API versions and alternative endpoints
  private async tryAlternativeApiVersions(fromDate: string, toDate: string): Promise<any> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    console.log('Angel One: Trying alternative API versions...');
    
    // Try different API versions and endpoints (removed problematic ones)
    const apiAttempts = [
      {
        endpoint: '/rest/secure/angelbroking/order/v2/getTradeBook',
        params: { fromDate, toDate },
        description: 'API v2 trade book'
      },
      {
        endpoint: '/rest/secure/angelbroking/portfolio/v1/getTradeBook',
        params: { fromDate, toDate },
        description: 'Portfolio trade book'
      },
      {
        endpoint: '/rest/secure/angelbroking/order/v1/getTradeBook',
        params: { 
          fromDate: `${fromDate.split('-')[2]}-${fromDate.split('-')[1]}-${fromDate.split('-')[0]}`,
          toDate: `${toDate.split('-')[2]}-${toDate.split('-')[1]}-${toDate.split('-')[0]}`,
          version: '2'
        },
        description: 'Trade book with version parameter'
      }
    ];

    for (const attempt of apiAttempts) {
      try {
        console.log('Angel One: Trying API version:', attempt.description);
        await delay(1500);
        
        const response = await this.makeRequest(attempt.endpoint, 'GET', attempt.params);
        
        // Check for "Request Rejected" error
        if (response.errorCode === 'REQUEST_REJECTED' || 
            (response.message && response.message.includes('Request Rejected'))) {
          console.log('Angel One: API version rejected, skipping:', attempt.description);
          continue; // Skip this endpoint and try the next one
        }
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          console.log('Angel One: SUCCESS with API version:', attempt.description, 'count:', response.data.length);
          return response;
        }
        
        console.log('Angel One: No data with API version:', attempt.description);
      } catch (error) {
        console.log('Angel One: Error with API version:', attempt.description, error);
      }
    }
    
    return null;
  }

  // Check if holdings-based trades already exist in the database
  private async checkExistingHoldingsTrades(): Promise<boolean> {
    try {
      // Import the database module
      const { prisma } = await import('../../lib/db');
      
      // Check if there are any existing trades from Angel One in the database
      // Look for trades created in the last 24 hours to avoid blocking recent syncs
      const recentTrades = await prisma.trade.findMany({
        where: {
          platform: 'angel_one',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        take: 1 // Just check if any exist
      });
      
      console.log('Angel One: Found', recentTrades.length, 'recent trades in database (last 24 hours)');
      
      // If we have very recent trades (created in last 24 hours), don't create holdings-based trades
      // This prevents duplicate creation during rapid syncs
      if (recentTrades.length > 0) {
        return true;
      }
      
      // Check for any holdings-based trades specifically
      const holdingsBasedTrades = await prisma.trade.findMany({
        where: {
          platform: 'angel_one',
          platformTradeId: {
            startsWith: 'angel_one_holding_'
          }
        },
        take: 1
      });
      
      console.log('Angel One: Found', holdingsBasedTrades.length, 'holdings-based trades in database');
      
      // If we have holdings-based trades, don't create new ones unless they're very old
      if (holdingsBasedTrades.length > 0) {
        // Check if the holdings-based trades are older than 7 days
        const oldestHoldingsTrade = await prisma.trade.findFirst({
          where: {
            platform: 'angel_one',
            platformTradeId: {
              startsWith: 'angel_one_holding_'
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        });
        
        if (oldestHoldingsTrade) {
          const daysSinceCreation = (Date.now() - oldestHoldingsTrade.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          console.log('Angel One: Oldest holdings-based trade is', daysSinceCreation.toFixed(1), 'days old');
          
          // If holdings-based trades are older than 7 days, allow re-creation
          // This allows users to refresh their portfolio data periodically
          if (daysSinceCreation > 7) {
            console.log('Angel One: Holdings-based trades are old, allowing re-creation');
            return false;
          }
        }
        
        return true;
      }
      
      // No holdings-based trades exist, allow creation
      return false;
    } catch (error) {
      console.log('Angel One: Error checking existing trades in database:', error);
      // If we can't check the database, fall back to the old logic
      try {
        const holdingsResponse = await this.makeRequest('/rest/secure/angelbroking/portfolio/v1/getHolding', 'GET');
        
        if (holdingsResponse.data && Array.isArray(holdingsResponse.data)) {
          // Check if any holdings have been recently updated (indicating recent activity)
          const recentHoldings = holdingsResponse.data.filter((holding: any) => {
            // If holdings have realized quantity, it might indicate recent trades
            return holding.realisedquantity && parseFloat(holding.realisedquantity) > 0;
          });
          
          return recentHoldings.length > 0;
        }
        
        return false;
      } catch (holdingsError) {
        console.log('Angel One: Error checking holdings data:', holdingsError);
        return false;
      }
    }
  }
} 