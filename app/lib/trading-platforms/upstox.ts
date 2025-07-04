import { BaseTradingPlatform, PlatformCredentials, PlatformTrade } from './base';

export class UpstoxPlatform extends BaseTradingPlatform {
  private accessToken: string;
  private refreshTokenValue: string;

  constructor(credentials: PlatformCredentials) {
    super({ baseUrl: 'https://api.upstox.com', timeout: 10000 }, credentials);
    // For OAuth, we use accessToken and refreshToken from the user's OAuth session
    this.accessToken = credentials.accessToken || '';
    this.refreshTokenValue = credentials.refreshToken || '';
  }

  async authenticate(): Promise<boolean> {
    try {
      if (!this.accessToken) {
        throw new Error('Access token is required for Upstox authentication. Please connect your Upstox account first.');
      }

      console.log('Upstox: Testing authentication with access token...');
      
      // Test the token by making a simple API call - try both endpoints
      try {
        const response = await this.makeRequest('/v2/user/profile', 'GET');
        console.log('Upstox: v2 profile endpoint successful');
        return response && response.data;
      } catch (error) {
        console.log('Upstox: v2 endpoint failed, trying index endpoint...');
        const response = await this.makeRequest('/index/user/profile', 'GET');
        console.log('Upstox: index profile endpoint successful');
        return response && response.data;
      }
    } catch (error) {
      console.error('Upstox authentication failed:', error);
      
      // Check for specific error types
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        console.log('Upstox: Token expired, attempting refresh...');
        const refreshed = await this.refreshToken();
        if (refreshed) {
          console.log('Upstox: Token refreshed successfully');
          return true;
        }
      }
      
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        console.error('Upstox: API endpoint not found. This might indicate account reactivation is required.');
        throw new Error('Upstox account may need reactivation. Please check your Upstox account status.');
      }
      
      return false;
    }
  }

  async getTrades(startDate?: Date, endDate?: Date): Promise<PlatformTrade[]> {
    try {
      console.log('Upstox: Starting trade fetch...');
      const isAuthenticated = await this.authenticate();
      if (!isAuthenticated) {
        throw new Error('Upstox authentication failed');
      }

      // 1. Try /order/trades/get-trades-for-day for today's trades
      let rawTrades: any[] = [];
      try {
        const todayTradesResponse = await this.makeRequest('/v2/order/trades/get-trades-for-day', 'GET');
        if (todayTradesResponse && todayTradesResponse.status === 'success' && Array.isArray(todayTradesResponse.data)) {
          rawTrades = todayTradesResponse.data;
        }
      } catch (err) {
        console.warn('Upstox: /order/trades/get-trades-for-day not available, trying /order/retrieve-all...');
      }

      // 2. Fallback to /order/retrieve-all for today's completed orders
      if (rawTrades.length === 0) {
        try {
          const ordersResponse = await this.makeRequest('/v2/order/retrieve-all', 'GET');
          if (ordersResponse && ordersResponse.status === 'success' && Array.isArray(ordersResponse.data)) {
            rawTrades = ordersResponse.data.filter((order: any) =>
              (order.status || '').toLowerCase().includes('complete') ||
              (order.status || '').toLowerCase().includes('filled')
            );
          }
        } catch (err) {
          console.warn('Upstox: /order/retrieve-all not available. No trades can be fetched.');
        }
      }

      if (rawTrades.length === 0) {
        return [];
      }

      // Group trades by symbol
      const tradesBySymbol: { [symbol: string]: any[] } = {};
      rawTrades.forEach((trade: any) => {
        const symbol = trade.symbol || trade.trading_symbol || trade.tradingsymbol;
        if (!tradesBySymbol[symbol]) {
          tradesBySymbol[symbol] = [];
        }
        tradesBySymbol[symbol].push(trade);
      });

      const pairedTrades: PlatformTrade[] = [];
      Object.keys(tradesBySymbol).forEach(symbol => {
        const optionDetails = this.parseOptionDetails(symbol);
        const symbolTrades = tradesBySymbol[symbol];
        const buyTrades = symbolTrades.filter((t: any) => (t.transaction_type || t.type)?.toUpperCase() === 'BUY');
        const sellTrades = symbolTrades.filter((t: any) => (t.transaction_type || t.type)?.toUpperCase() === 'SELL');

        // Calculate total buy quantity and average buy price
        let totalBuyQuantity = 0;
        let totalBuyValue = 0;
        buyTrades.forEach((trade: any) => {
          const qty = parseFloat(trade.quantity);
          const price = parseFloat(trade.price || trade.average_price);
          totalBuyQuantity += qty;
          totalBuyValue += qty * price;
        });
        const averageBuyPrice = totalBuyQuantity > 0 ? totalBuyValue / totalBuyQuantity : 0;

        // Calculate total sell quantity and average sell price
        let totalSellQuantity = 0;
        let totalSellValue = 0;
        sellTrades.forEach((trade: any) => {
          const qty = parseFloat(trade.quantity);
          const price = parseFloat(trade.price || trade.average_price);
          totalSellQuantity += qty;
          totalSellValue += qty * price;
        });
        const averageSellPrice = totalSellQuantity > 0 ? totalSellValue / totalSellQuantity : 0;

        // Create paired trades
        if (totalBuyQuantity > 0 && totalSellQuantity > 0) {
          // Complete trade (both buy and sell)
          const completedQuantity = Math.min(totalBuyQuantity, totalSellQuantity);
          const actualPL = (averageSellPrice - averageBuyPrice) * completedQuantity;
          const firstBuyTrade = buyTrades[0];
          const firstSellTrade = sellTrades[0];
          const pairedTrade: PlatformTrade = {
            id: `${firstBuyTrade.order_id || firstBuyTrade.trade_id}_${firstSellTrade.order_id || firstSellTrade.trade_id}`,
            symbol: symbol,
            type: 'LONG',
            instrumentType: this.resolveInstrumentType(symbol, firstBuyTrade.segment || '', optionDetails),
            entryPrice: parseFloat(averageBuyPrice.toFixed(2)),
            exitPrice: parseFloat(averageSellPrice.toFixed(2)),
            quantity: completedQuantity,
            entryDate: this.parseTradeTimestamp(firstBuyTrade),
            exitDate: this.parseTradeTimestamp(firstSellTrade),
            profitLoss: parseFloat(actualPL.toFixed(2)),
            orderId: `${firstBuyTrade.order_id}_${firstSellTrade.order_id}`,
            tradeId: `${firstBuyTrade.trade_id || firstBuyTrade.order_id}_${firstSellTrade.trade_id || firstSellTrade.order_id}`,
            exchange: firstBuyTrade.exchange,
            segment: firstBuyTrade.segment,
            status: 'COMPLETE',
            ...optionDetails,
            rawData: { buy: firstBuyTrade, sell: firstSellTrade }
          };
          pairedTrades.push(pairedTrade);

          // If there are remaining quantities, create open positions
          if (totalBuyQuantity > totalSellQuantity) {
            const remainingQuantity = totalBuyQuantity - totalSellQuantity;
            const openTrade: PlatformTrade = {
              id: `${firstBuyTrade.order_id || firstBuyTrade.trade_id}_open`,
              symbol: symbol,
              type: 'LONG',
              instrumentType: this.resolveInstrumentType(symbol, firstBuyTrade.segment || '', optionDetails),
              entryPrice: parseFloat(averageBuyPrice.toFixed(2)),
              quantity: remainingQuantity,
              entryDate: this.parseTradeTimestamp(firstBuyTrade),
              orderId: firstBuyTrade.order_id,
              tradeId: firstBuyTrade.trade_id,
              exchange: firstBuyTrade.exchange,
              segment: firstBuyTrade.segment,
              status: 'OPEN',
              ...optionDetails,
              rawData: { buy: firstBuyTrade }
            };
            pairedTrades.push(openTrade);
          }
        } else if (totalBuyQuantity > 0) {
          // Only buy trades (open position)
          const firstBuyTrade = buyTrades[0];
          const openTrade: PlatformTrade = {
            id: `${firstBuyTrade.order_id || firstBuyTrade.trade_id}_open`,
            symbol: symbol,
            type: 'LONG',
            instrumentType: this.resolveInstrumentType(symbol, firstBuyTrade.segment || '', optionDetails),
            entryPrice: parseFloat(averageBuyPrice.toFixed(2)),
            quantity: totalBuyQuantity,
            entryDate: this.parseTradeTimestamp(firstBuyTrade),
            orderId: firstBuyTrade.order_id,
            tradeId: firstBuyTrade.trade_id,
            exchange: firstBuyTrade.exchange,
            segment: firstBuyTrade.segment,
            status: 'OPEN',
            ...optionDetails,
            rawData: { buy: firstBuyTrade }
          };
          pairedTrades.push(openTrade);
        } else if (totalSellQuantity > 0) {
          // Only sell trades (short position)
          const firstSellTrade = sellTrades[0];
          const shortTrade: PlatformTrade = {
            id: `${firstSellTrade.order_id || firstSellTrade.trade_id}_short`,
            symbol: symbol,
            type: 'SHORT',
            instrumentType: this.resolveInstrumentType(symbol, firstSellTrade.segment || '', optionDetails),
            entryPrice: parseFloat(averageSellPrice.toFixed(2)),
            quantity: totalSellQuantity,
            entryDate: this.parseTradeTimestamp(firstSellTrade),
            orderId: firstSellTrade.order_id,
            tradeId: firstSellTrade.trade_id,
            exchange: firstSellTrade.exchange,
            segment: firstSellTrade.segment,
            status: 'OPEN',
            ...optionDetails,
            rawData: { sell: firstSellTrade }
          };
          pairedTrades.push(shortTrade);
        }
      });

      return pairedTrades;
    } catch (error) {
      console.error('Error fetching Upstox trades:', error);
      throw error;
    }
  }

  async getTradeHistory(symbol?: string, startDate?: Date, endDate?: Date): Promise<PlatformTrade[]> {
    try {
      const isAuthenticated = await this.authenticate();
      if (!isAuthenticated) {
        throw new Error('Upstox authentication failed');
      }
      // Use /charges/historical-trades for historical trades
      if (!startDate || !endDate) {
        throw new Error('Start date and end date are required for historical trades');
      }
      const params = new URLSearchParams({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        page_number: '1',
        page_size: '100',
      });
      if (symbol) {
        params.append('symbol', symbol);
      }
      const response = await this.makeRequest(`/v2/charges/historical-trades?${params.toString()}`, 'GET');
      if (!response || response.status !== 'success' || !Array.isArray(response.data)) {
        return [];
      }
      return response.data.map((trade: any) => ({
        id: trade.trade_id || trade.order_id,
        symbol: trade.symbol || trade.scrip_name || trade.trading_symbol || trade.tradingsymbol,
        type: (trade.transaction_type?.toLowerCase() === 'buy') ? 'LONG' : 'SHORT',
        instrumentType: this.resolveInstrumentType(
          trade.symbol || trade.scrip_name || trade.trading_symbol || trade.tradingsymbol,
          trade.segment || '',
          {}
        ),
        entryPrice: parseFloat(trade.price || trade.average_price) || 0,
        quantity: parseInt(trade.quantity) || 0,
        entryDate: trade.trade_date ? new Date(trade.trade_date).toISOString() : new Date().toISOString(),
        orderId: trade.order_id,
        tradeId: trade.trade_id,
        status: trade.status || 'COMPLETE',
        exchange: trade.exchange,
        segment: trade.segment,
      } as PlatformTrade));
    } catch (error) {
      console.error('Error fetching Upstox trade history:', error);
      return [];
    }
  }

  async getAccountInfo(): Promise<any> {
    try {
      console.log('Upstox: Fetching account info...');
      
      // Try v2 endpoints first, then fallback to index endpoints
      let profileResponse, holdingsResponse;
      
      try {
        profileResponse = await this.makeRequest('/v2/user/profile', 'GET');
        console.log('Upstox: v2 profile successful');
        holdingsResponse = await this.makeRequest('/v2/portfolio/holdings', 'GET');
        console.log('Upstox: v2 holdings successful');
      } catch (error) {
        console.log('Upstox: v2 endpoints failed, trying index endpoints...');
        profileResponse = await this.makeRequest('/index/user/profile', 'GET');
        console.log('Upstox: index profile successful');
        holdingsResponse = await this.makeRequest('/index/portfolio/positions', 'GET');
        console.log('Upstox: index positions successful');
      }
      
      return {
        profile: profileResponse?.data,
        holdings: holdingsResponse?.data,
        platform: 'UPSTOX'
      };
    } catch (error) {
      console.error('Error fetching Upstox account info:', error);
      return null;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('Upstox: Testing connection...');
      if (!this.accessToken) {
        return {
          success: false,
          message: 'No access token available. Please connect your Upstox account first.'
        };
      }
      // Test authentication
      const isAuthenticated = await this.authenticate();
      if (!isAuthenticated) {
        return {
          success: false,
          message: 'Authentication failed. Your access token may have expired.'
        };
      }
      // Test profile endpoint
      const profileResponse = await this.makeRequest('/v2/user/profile', 'GET');
      if (!profileResponse?.data) {
        return {
          success: false,
          message: 'Profile endpoint not accessible. Account may need reactivation.'
        };
      }
      // Test historical trades endpoint
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
      const params = new URLSearchParams({
        start_date: start.toISOString().split('T')[0],
        end_date: today.toISOString().split('T')[0],
        page_number: '1',
        page_size: '1'
      });
      try {
        const historyResponse = await this.makeRequest(`/v2/charges/historical-trades?${params.toString()}`, 'GET');
        if (historyResponse && historyResponse.status === 'success' && Array.isArray(historyResponse.data)) {
          return {
            success: true,
            message: 'Connection successful. Historical trades endpoint accessible.',
            details: { profile: profileResponse.data, historicalTradesAccessible: true }
          };
        }
      } catch (err) {
        // Fallback to today's trades
        try {
          const tradesResponse = await this.makeRequest('/v2/order/trades/get-trades-for-day', 'GET');
          if (tradesResponse && tradesResponse.status === 'success' && Array.isArray(tradesResponse.data)) {
            return {
              success: true,
              message: 'Connection successful. Trades endpoint accessible.',
              details: { profile: profileResponse.data, tradesAccessible: true }
            };
          }
        } catch (err2) {
          // Fallback to today's order book
          try {
            const ordersResponse = await this.makeRequest('/v2/order/retrieve-all', 'GET');
            if (ordersResponse && ordersResponse.status === 'success' && Array.isArray(ordersResponse.data)) {
              return {
                success: true,
                message: 'Connection successful. Order book endpoint accessible.',
                details: { profile: profileResponse.data, orderBookAccessible: true }
              };
            }
          } catch (err3) {
            // All failed
          }
        }
      }
      return {
        success: false,
        message: 'No accessible trade/order endpoints found. Please check your Upstox account and API permissions.',
        details: { profile: profileResponse.data }
      };
    } catch (error) {
      console.error('Upstox connection test failed:', error);
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      if (!this.refreshTokenValue) {
        throw new Error('Refresh token not available');
      }

      // For OAuth refresh, we need the application's client credentials
      const clientId = process.env.UPSTOX_CLIENT_ID;
      const clientSecret = process.env.UPSTOX_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('Upstox application credentials not configured');
      }

      const response = await fetch('https://api.upstox.com/v2/login/authorization/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Api-Version': '2.0'
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.refreshTokenValue
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.refreshTokenValue = data.refresh_token || this.refreshTokenValue;

      return true;
    } catch (error) {
      console.error('Error refreshing Upstox token:', error);
      return false;
    }
  }

  protected async makeRequest(endpoint: string, method: string, data?: any): Promise<any> {
    try {
      const url = `${this.config.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.accessToken}`,
        'Api-Version': '2.0',
        'Content-Type': 'application/json'
      };

      const options: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      };

      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }

      console.log('Upstox: Making request to:', url);
      const response = await fetch(url, options);

      console.log('Upstox: Response status:', response.status, response.statusText);

      if (response.status === 401) {
        console.log('Upstox: 401 Unauthorized - attempting token refresh...');
        // Token expired, try to refresh
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry the request with new token
          headers.Authorization = `Bearer ${this.accessToken}`;
          console.log('Upstox: Retrying request with refreshed token...');
          const retryResponse = await fetch(url, { ...options, headers });
          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            console.error('Upstox: Retry failed:', retryResponse.status, errorText);
            throw new Error(`Upstox API error: ${retryResponse.status} ${retryResponse.statusText}`);
          }
          return await retryResponse.json();
        } else {
          throw new Error('Token refresh failed');
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upstox: API request failed:', response.status, response.statusText);
        console.error('Upstox: Error response body:', errorText);
        
        // Try to parse error response for more details
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.errors && errorData.errors.length > 0) {
            const errorCode = errorData.errors[0].errorCode;
            const errorMessage = errorData.errors[0].message;
            
            if (errorCode === 'UDAPI100058') {
              throw new Error('Account reactivation required. Please reactivate your Upstox account.');
            }
            
            throw new Error(`Upstox API error: ${errorCode} - ${errorMessage}`);
          }
        } catch (parseError) {
          // If we can't parse the error, use the status text
        }
        
        throw new Error(`Upstox API error: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('Upstox: Request successful');
      return responseData;
    } catch (error) {
      console.error('Upstox API request failed:', error);
      throw error;
    }
  }

  protected mapInstrumentType(productType: string): 'STOCK' | 'FUTURES' | 'OPTIONS' {
    const type = (productType || '').toUpperCase();
    
    // Upstox specific segment/product mappings
    if (type.includes('OPT') || type.includes('CE') || type.includes('PE') || type === 'NFO') {
      return 'OPTIONS';
    }
    
    if (type.includes('FUT')) {
      return 'FUTURES';
    }
    
    return 'STOCK';
  }

  private parseTradeTimestamp(trade: any): string {
    /**
     * Upstox trades can arrive with multiple possible timestamp fields depending on
     * which endpoint is used (trades-for-day, order book etc.).
     * 1. Prefer explicit timestamp fields if they are present and valid.
     * 2. If no full timestamp is available, derive the *date* portion from the
     *    YYMMDD prefix of the order_id (Upstox embeds trade date in order id just
     *    like Angel One) and the *time* portion from any fill/time field.
     * 3. Fall back to the current time – this should be extremely rare.
     */
    const potentialFields = [
      trade.exchange_timestamp,
      trade.order_timestamp,
      trade.trade_timestamp,
      trade.timestamp,
      trade.filled_at,
      trade.fill_timestamp,
    ];

    for (const ts of potentialFields) {
      if (ts) {
        const parsed = new Date(ts);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }
    }

    // Derive date from order_id (first 6 digits ⇒ YYMMDD)
    const orderId: string | undefined = trade.order_id || trade.trade_id;
    if (orderId && /^\d{6}/.test(orderId)) {
      const idDate = orderId.substring(0, 6); // YYMMDD
      const year = 2000 + parseInt(idDate.substring(0, 2), 10);
      const month = parseInt(idDate.substring(2, 4), 10) - 1; // zero-based in JS
      const day = parseInt(idDate.substring(4, 6), 10);

      // Attempt to get a fill time (HH:mm[:ss])
      const timeCandidates = [
        trade.fill_time,
        trade.filltimestamp,
        trade.filled_time,
        trade.updatedTime,
      ];
      let hours = 0, minutes = 0, seconds = 0;
      for (const t of timeCandidates) {
        if (typeof t === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(t.trim())) {
          const parts = t.trim().split(':');
          hours = parseInt(parts[0], 10);
          minutes = parseInt(parts[1], 10);
          seconds = parts[2] ? parseInt(parts[2], 10) : 0;
          break;
        }
      }
      // Construct the date in the **local** timezone so that the hours/minutes
      // map directly to what the user sees on contract notes / Upstox UI.
      const derivedLocal = new Date(year, month, day, hours, minutes, seconds);
      return derivedLocal.toISOString();
    }

    // Fallback – now()
    return new Date().toISOString();
  }
} 