import { BaseTradingPlatform, PlatformTrade, PlatformCredentials, PlatformConfig } from './base';
import { KiteConnect } from 'kiteconnect';

export class ZerodhaPlatform extends BaseTradingPlatform {
  private kite: any;
  private _accessToken: string | null = null;

  constructor(credentials: PlatformCredentials) {
    super({
      baseUrl: 'https://api.kite.trade',
      apiVersion: 'v3',
      timeout: 30000,
      retryAttempts: 3
    }, credentials);

    // Initialize KiteConnect SDK
    this.kite = new KiteConnect({
      api_key: this.credentials.apiKey || process.env.ZERODHA_CLIENT_ID || '',
    });

    // Set access token if available
    if (this.credentials.accessToken) {
      this._accessToken = this.credentials.accessToken;
      this.kite.setAccessToken(this.credentials.accessToken);
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      // If we already have a valid access token, use it
      if (this.credentials.accessToken && this.credentials.tokenExpiry && new Date() < this.credentials.tokenExpiry) {
        this._accessToken = this.credentials.accessToken;
        this.kite.setAccessToken(this.credentials.accessToken);
        console.log('Zerodha: Using existing valid access token');
        return true;
      }

      // If we have an access token but no expiry, assume it's valid for now
      if (this.credentials.accessToken) {
        this._accessToken = this.credentials.accessToken;
        this.kite.setAccessToken(this.credentials.accessToken);
        console.log('Zerodha: Using access token without expiry check');
        return true;
      }

      // For Zerodha, we need to use the login API with API key and secret
      if (this.credentials.requestToken) {
        console.log('Zerodha: Exchanging request token for access token');
        
        try {
          const session = await this.kite.generateSession(
            this.credentials.requestToken,
            this.credentials.apiSecret || process.env.ZERODHA_CLIENT_SECRET || ''
          );

          if (session.access_token) {
            this._accessToken = session.access_token;
            this.kite.setAccessToken(session.access_token);
            console.log('Zerodha: Successfully generated session');
            return true;
          }
        } catch (error) {
          console.error('Zerodha session generation failed:', error);
          return false;
        }
      }

      console.log('Zerodha: No valid authentication method available');
      return false;
    } catch (error) {
      console.error('Zerodha authentication failed:', error);
      return false;
    }
  }

  async refreshToken(): Promise<boolean> {
    // Zerodha doesn't support refresh tokens, so we return false
    console.log('Zerodha: Refresh tokens not supported');
    return false;
  }

  async getTrades(startDate?: Date, endDate?: Date): Promise<PlatformTrade[]> {
    try {
      console.log('Zerodha getTrades: Fetching trades using KiteConnect SDK');
      console.log('Date range:', { startDate, endDate });
      console.log('Zerodha API Limitation: getTrades() only returns today\'s trades');

      // Get today's trades
      const todayTrades = await this.kite.getTrades();
      
      if (!todayTrades || !Array.isArray(todayTrades) || todayTrades.length === 0) {
        console.log('No trades found for today');
        return [];
      }

      console.log('Raw Zerodha trades:', todayTrades);

      // Also get positions data to enhance P&L information
      let positionsData: any = {};
      try {
        const positions = await this.kite.getPositions();
        console.log('Zerodha positions data:', positions);
        
        // Create a lookup map for positions by symbol
        if (positions && positions.day) {
          positions.day.forEach((pos: any) => {
            if (pos.tradingsymbol) {
              positionsData[pos.tradingsymbol] = pos;
            }
          });
        }
      } catch (positionsError) {
        console.warn('Failed to fetch positions data:', positionsError);
      }

      // Filter by date range if provided (though this will only affect today's trades)
      let filteredTrades = todayTrades;
      if (startDate || endDate) {
        // For Zerodha, since we can only get today's trades, we should always include them
        // regardless of the requested date range, as this is a limitation of their API
        console.log('Zerodha: Including today\'s trades despite date range request (API limitation)');
        
        // Still filter by individual trade timestamps if they exist
        filteredTrades = todayTrades.filter((trade: any) => {
          if (!trade.trade_timestamp) {
            return true; // Include trades without timestamp
          }
          const tradeDate = new Date(trade.trade_timestamp);
          const fromDate = startDate || new Date(0);
          const toDate = endDate || new Date();
          return tradeDate >= fromDate && tradeDate <= toDate;
        });
      }

      console.log('Filtered trades count:', filteredTrades.length);

      // Group trades by symbol to pair BUY and SELL trades
      const tradesBySymbol: { [symbol: string]: any[] } = {};
      filteredTrades.forEach((trade: any) => {
        const symbol = trade.tradingsymbol;
        if (!tradesBySymbol[symbol]) {
          tradesBySymbol[symbol] = [];
        }
        tradesBySymbol[symbol].push(trade);
      });

      // Process each symbol's trades to create paired trades
      const pairedTrades: PlatformTrade[] = [];
      
      Object.keys(tradesBySymbol).forEach(symbol => {
        const optionDetails = this.parseOptionDetails(symbol);
        const symbolTrades = tradesBySymbol[symbol];
        const buyTrades = symbolTrades.filter((t: any) => t.transaction_type === 'BUY');
        const sellTrades = symbolTrades.filter((t: any) => t.transaction_type === 'SELL');
        
        console.log(`Processing ${symbol}: ${buyTrades.length} BUY trades, ${sellTrades.length} SELL trades`);
        
        // Calculate total buy quantity and average buy price
        let totalBuyQuantity = 0;
        let totalBuyValue = 0;
        buyTrades.forEach((trade: any) => {
          const qty = parseFloat(trade.quantity);
          const price = parseFloat(trade.average_price);
          totalBuyQuantity += qty;
          totalBuyValue += qty * price;
        });
        
        const averageBuyPrice = totalBuyQuantity > 0 ? totalBuyValue / totalBuyQuantity : 0;
        
        // Calculate total sell quantity and average sell price
        let totalSellQuantity = 0;
        let totalSellValue = 0;
        sellTrades.forEach((trade: any) => {
          const qty = parseFloat(trade.quantity);
          const price = parseFloat(trade.average_price);
          totalSellQuantity += qty;
          totalSellValue += qty * price;
        });
        
        const averageSellPrice = totalSellQuantity > 0 ? totalSellValue / totalSellQuantity : 0;
        
        console.log(`${symbol} - Buy: ${totalBuyQuantity} @ ${averageBuyPrice.toFixed(2)}, Sell: ${totalSellQuantity} @ ${averageSellPrice.toFixed(2)}`);
        
        // Get position data for this symbol
        const position = positionsData[symbol];
        let positionPL = 0;
        if (position && position.pnl) {
          positionPL = parseFloat(position.pnl);
        }
        
        // Create paired trades
        if (totalBuyQuantity > 0 && totalSellQuantity > 0) {
          // Complete trade (both buy and sell)
          const completedQuantity = Math.min(totalBuyQuantity, totalSellQuantity);
          const actualPL = (averageSellPrice - averageBuyPrice) * completedQuantity;
          
          console.log(`${symbol} - Complete trade P&L: ${actualPL.toFixed(2)} (${averageSellPrice.toFixed(2)} - ${averageBuyPrice.toFixed(2)}) × ${completedQuantity}`);
          
          // Use the first buy trade as the base for the paired trade
          const firstBuyTrade = buyTrades[0];
          const firstSellTrade = sellTrades[0];
          
          const pairedTrade: PlatformTrade = {
            id: `${firstBuyTrade.trade_id}_${firstSellTrade.trade_id}`,
            symbol: symbol,
            type: 'LONG',
            instrumentType: this.resolveInstrumentType(symbol, firstBuyTrade.product, optionDetails),
            entryPrice: parseFloat(averageBuyPrice.toFixed(2)),
            exitPrice: parseFloat(averageSellPrice.toFixed(2)),
            quantity: completedQuantity,
            entryDate: firstBuyTrade.fill_timestamp || firstBuyTrade.trade_timestamp,
            exitDate: firstSellTrade.fill_timestamp || firstSellTrade.trade_timestamp,
            profitLoss: parseFloat(actualPL.toFixed(2)),
            orderId: `${firstBuyTrade.order_id}_${firstSellTrade.order_id}`,
            tradeId: `${firstBuyTrade.trade_id}_${firstSellTrade.trade_id}`,
            exchange: firstBuyTrade.exchange,
            segment: firstBuyTrade.segment || 'EQ',
            productType: firstBuyTrade.product,
            orderType: firstBuyTrade.order_type || 'MARKET',
            status: 'COMPLETE',
            ...optionDetails,
            rawData: { buy: firstBuyTrade, sell: firstSellTrade }
          };
          
          pairedTrades.push(pairedTrade);
          
          // If there are remaining quantities, create open positions
          if (totalBuyQuantity > totalSellQuantity) {
            const remainingQuantity = totalBuyQuantity - totalSellQuantity;
            const openTrade: PlatformTrade = {
              id: `${firstBuyTrade.trade_id}_open`,
              symbol: symbol,
              type: 'LONG',
              instrumentType: this.resolveInstrumentType(symbol, firstBuyTrade.product, optionDetails),
              entryPrice: parseFloat(averageBuyPrice.toFixed(2)),
              exitPrice: undefined,
              quantity: remainingQuantity,
              entryDate: firstBuyTrade.fill_timestamp || firstBuyTrade.trade_timestamp,
              exitDate: undefined,
              profitLoss: positionPL, // Use position P&L for open trades
              orderId: firstBuyTrade.order_id,
              tradeId: firstBuyTrade.trade_id,
              exchange: firstBuyTrade.exchange,
              segment: firstBuyTrade.segment || 'EQ',
              productType: firstBuyTrade.product,
              orderType: firstBuyTrade.order_type || 'MARKET',
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
            id: `${firstBuyTrade.trade_id}_open`,
            symbol: symbol,
            type: 'LONG',
            instrumentType: this.resolveInstrumentType(symbol, firstBuyTrade.product, optionDetails),
            entryPrice: parseFloat(averageBuyPrice.toFixed(2)),
            exitPrice: undefined,
            quantity: totalBuyQuantity,
            entryDate: firstBuyTrade.fill_timestamp || firstBuyTrade.trade_timestamp,
            exitDate: undefined,
            profitLoss: positionPL, // Use position P&L for open trades
            orderId: firstBuyTrade.order_id,
            tradeId: firstBuyTrade.trade_id,
            exchange: firstBuyTrade.exchange,
            segment: firstBuyTrade.segment || 'EQ',
            productType: firstBuyTrade.product,
            orderType: firstBuyTrade.order_type || 'MARKET',
            status: 'OPEN',
            ...optionDetails,
            rawData: { buy: firstBuyTrade }
          };
          
          pairedTrades.push(openTrade);
        } else if (totalSellQuantity > 0) {
          // Only sell trades (short position)
          const firstSellTrade = sellTrades[0];
          const shortTrade: PlatformTrade = {
            id: `${firstSellTrade.trade_id}_short`,
            symbol: symbol,
            type: 'SHORT',
            instrumentType: this.resolveInstrumentType(symbol, firstSellTrade.product, optionDetails),
            entryPrice: parseFloat(averageSellPrice.toFixed(2)),
            exitPrice: undefined,
            quantity: totalSellQuantity,
            entryDate: firstSellTrade.fill_timestamp || firstSellTrade.trade_timestamp,
            exitDate: undefined,
            profitLoss: positionPL, // Use position P&L for short trades
            orderId: firstSellTrade.order_id,
            tradeId: firstSellTrade.trade_id,
            exchange: firstSellTrade.exchange,
            segment: firstSellTrade.segment || 'EQ',
            productType: firstSellTrade.product,
            orderType: firstSellTrade.order_type || 'MARKET',
            status: 'OPEN',
            ...optionDetails,
            rawData: { sell: firstSellTrade }
          };
          
          pairedTrades.push(shortTrade);
        }
      });

      console.log('Final paired trades:', pairedTrades.map(t => ({
        symbol: t.symbol,
        type: t.type,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        quantity: t.quantity,
        profitLoss: t.profitLoss,
        status: t.status
      })));

      return pairedTrades;
    } catch (error) {
      console.error('Failed to fetch Zerodha trades:', error);
      
      // Check if it's a token expiration error - handle both Error objects and KiteConnect error objects
      if (typeof error === 'object' && error !== null) {
        const errorObj = error as any;
        
        // Check for KiteConnect TokenException structure
        if (errorObj.error_type === 'TokenException' || 
            (errorObj.message && errorObj.message.includes('Incorrect `api_key` or `access_token`'))) {
          // Throw the original error object so the sync route can detect it properly
          throw error;
        }
      }
      
      // Check if it's an Error object with TokenException
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorData = error instanceof Error ? (error as any) : {};
      
      if (errorMessage.includes('Incorrect `api_key` or `access_token`') || 
          errorData.error_type === 'TokenException' ||
          errorMessage.includes('TokenException')) {
        const tokenError = new Error('Zerodha access token has expired. Please reconnect your account.');
        (tokenError as any).error_type = 'TokenException';
        (tokenError as any).isTokenExpired = true;
        throw tokenError;
      }
      
      throw error;
    }
  }

  async getTradeHistory(symbol?: string, startDate?: Date, endDate?: Date): Promise<PlatformTrade[]> {
    try {
      console.log('Zerodha getTradeHistory: Fetching trade history using KiteConnect SDK');
      console.log('Zerodha API Limitation: Only today\'s trades are available via API');

      // Get today's trades
      const todayTrades = await this.kite.getTrades();
      
      if (!todayTrades || !Array.isArray(todayTrades) || todayTrades.length === 0) {
        console.log('No trades found for today');
        return [];
      }

      // Filter by symbol if provided
      let filteredTrades = todayTrades;
      if (symbol) {
        filteredTrades = filteredTrades.filter((trade: any) => 
          trade.tradingsymbol === symbol
        );
      }
      
      // Filter by date range if provided (though this will only affect today's trades)
      if (startDate || endDate) {
        // For Zerodha, since we can only get today's trades, we should always include them
        // regardless of the requested date range, as this is a limitation of their API
        console.log('Zerodha: Including today\'s trades despite date range request (API limitation)');
        
        // Still filter by individual trade timestamps if they exist
        filteredTrades = filteredTrades.filter((trade: any) => {
          if (!trade.trade_timestamp) {
            return true; // Include trades without timestamp
          }
          const tradeDate = new Date(trade.trade_timestamp);
          const fromDate = startDate || new Date(0);
          const toDate = endDate || new Date();
          return tradeDate >= fromDate && tradeDate <= toDate;
        });
      }

      console.log('Filtered trades for history:', filteredTrades.length);

      return filteredTrades.map((trade: any) => this.mapZerodhaTrade(trade));
    } catch (error) {
      console.error('Failed to fetch Zerodha trade history:', error);
      return [];
    }
  }

  async getAccountInfo(): Promise<any> {
    try {
      console.log('Zerodha getAccountInfo: Fetching user profile using KiteConnect SDK');
      const profile = await this.kite.getProfile();
      console.log('Zerodha profile:', profile);
      return profile || {};
    } catch (error) {
      console.error('Failed to fetch Zerodha account info:', error);
      return {};
    }
  }

  // Test method to debug what data is available
  async testConnection(): Promise<any> {
    try {
      console.log('Zerodha testConnection: Testing API connectivity');
      
      // Test profile
      const profile = await this.kite.getProfile();
      console.log('Profile test:', profile);
      
      // Test orders (note: this might be empty for many users)
      const orders = await this.kite.getOrders();
      console.log('Orders test:', orders?.length || 0, 'orders found');
      
      // Test today's trades (this is the main limitation)
      const todayTrades = await this.kite.getTrades();
      console.log('Today\'s trades test:', todayTrades?.length || 0, 'trades found');
      
      // Test holdings (this is usually available)
      const holdings = await this.kite.getHoldings();
      console.log('Holdings test:', holdings?.length || 0, 'holdings found');
      
      // Test positions
      const positions = await this.kite.getPositions();
      console.log('Positions test:', positions);
      
      // ⚠️ API Limitations Summary
      const limitations = {
        historicalTrades: 'NOT AVAILABLE - Zerodha API only provides today\'s trades',
        orderHistory: 'LIMITED - Only recent orders may be available',
        holdings: 'AVAILABLE - Current portfolio holdings',
        positions: 'AVAILABLE - Current open positions',
        profile: 'AVAILABLE - User profile and account details'
      };
      
      return {
        profile,
        ordersCount: orders?.length || 0,
        todayTradesCount: todayTrades?.length || 0,
        holdingsCount: holdings?.length || 0,
        positions: positions,
        apiLimitations: limitations,
        note: 'Zerodha Kite Connect API only provides today\'s trades. Historical trade data is not available through the API.'
      };
    } catch (error) {
      console.error('Zerodha testConnection failed:', error);
      
      // Check if it's a token expiration error - handle both Error objects and KiteConnect error objects
      if (typeof error === 'object' && error !== null) {
        const errorObj = error as any;
        
        // Check for KiteConnect TokenException structure
        if (errorObj.error_type === 'TokenException' || 
            (errorObj.message && errorObj.message.includes('Incorrect `api_key` or `access_token`'))) {
          // Throw the original error object so the sync route can detect it properly
          throw error;
        }
      }
      
      // Check if it's an Error object with TokenException
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorData = error instanceof Error ? (error as any) : {};
      
      if (errorMessage.includes('Incorrect `api_key` or `access_token`') || 
          errorData.error_type === 'TokenException' ||
          errorMessage.includes('TokenException')) {
        const tokenError = new Error('Zerodha access token has expired. Please reconnect your account.');
        (tokenError as any).error_type = 'TokenException';
        (tokenError as any).isTokenExpired = true;
        throw tokenError;
      }
      
      throw error;
    }
  }

  // Additional methods for other data types
  async getOrders(): Promise<any[]> {
    try {
      console.log('Zerodha getOrders: Fetching orders using KiteConnect SDK');
      const orders = await this.kite.getOrders();
      return orders || [];
    } catch (error) {
      console.error('Failed to fetch Zerodha orders:', error);
      return [];
    }
  }

  async getHoldings(): Promise<any[]> {
    try {
      console.log('Zerodha getHoldings: Fetching holdings using KiteConnect SDK');
      const holdings = await this.kite.getHoldings();
      return holdings || [];
    } catch (error) {
      console.error('Failed to fetch Zerodha holdings:', error);
      return [];
    }
  }

  async getPositions(): Promise<any> {
    try {
      console.log('Zerodha getPositions: Fetching positions using KiteConnect SDK');
      const positions = await this.kite.getPositions();
      return positions || {};
    } catch (error) {
      console.error('Failed to fetch Zerodha positions:', error);
      return {};
    }
  }

  async getMargins(): Promise<any> {
    try {
      console.log('Zerodha getMargins: Fetching margins using KiteConnect SDK');
      const margins = await this.kite.getMargins();
      return margins || {};
    } catch (error) {
      console.error('Failed to fetch Zerodha margins:', error);
      return {};
    }
  }

  protected async makeRequest(endpoint: string, method: string, data?: any): Promise<any> {
    // This method is not used with KiteConnect SDK, but kept for compatibility
    console.log('Zerodha makeRequest: Using KiteConnect SDK instead of raw HTTP requests');
    throw new Error('Use KiteConnect SDK methods instead of makeRequest');
  }

  private mapZerodhaTrade(trade: any): PlatformTrade {
    console.log('Zerodha raw trade data:', trade);
    
    const isBuy = trade.transaction_type === 'BUY';
    
    // Handle different field names between regular trades and order trades
    const tradeId = trade.trade_id || trade.id;
    const orderId = trade.order_id || trade.orderId;
    const symbol = trade.tradingsymbol || trade.symbol;
    const averagePrice = trade.average_price || trade.price || trade.fill_price;
    const quantity = trade.quantity || trade.qty || trade.filled;
    const timestamp = trade.trade_timestamp || trade.fill_timestamp || trade.timestamp;
    const exchange = trade.exchange || 'NSE';
    const product = trade.product || 'CNC';
    
    // Calculate P&L - try multiple approaches
    let profitLoss: number | undefined = undefined;
    let exitPrice: number | undefined = undefined;
    let exitDate: string | undefined = undefined;
    let status: string = 'OPEN';
    
    if (trade.pnl !== undefined) {
      profitLoss = parseFloat(trade.pnl);
      status = 'COMPLETED';
    }
    
    if (trade.exitPrice !== undefined) {
      exitPrice = parseFloat(trade.exitPrice);
      status = 'COMPLETED';
    }
    
    if (trade.exitDate !== undefined) {
      exitDate = trade.exitDate;
      status = 'COMPLETED';
    }
    
    // Parse option details from symbol
    const optionDetails = this.parseOptionDetails(symbol);
    
    const mappedTrade: PlatformTrade = {
      id: tradeId,
      symbol: symbol,
      type: isBuy ? 'LONG' : 'SHORT',
      instrumentType: this.resolveInstrumentType(symbol, product, optionDetails),
      entryPrice: parseFloat(averagePrice) || 0,
      exitPrice: exitPrice,
      quantity: parseFloat(quantity) || 0,
      entryDate: timestamp,
      exitDate: exitDate,
      profitLoss: profitLoss,
      orderId: orderId,
      tradeId: tradeId,
      exchange: exchange,
      segment: trade.segment || 'EQ',
      productType: product,
      orderType: trade.order_type || 'MARKET',
      status: status,
      ...optionDetails,
      rawData: trade
    };
    
    console.log('Zerodha mapped trade:', {
      symbol: mappedTrade.symbol,
      type: mappedTrade.type,
      entryPrice: mappedTrade.entryPrice,
      exitPrice: mappedTrade.exitPrice,
      quantity: mappedTrade.quantity,
      profitLoss: mappedTrade.profitLoss,
      status: mappedTrade.status,
      strikePrice: mappedTrade.strikePrice,
      expiryDate: mappedTrade.expiryDate,
      optionType: mappedTrade.optionType
    });
    
    return mappedTrade;
  }

  protected mapInstrumentType(productType: string): 'STOCK' | 'FUTURES' | 'OPTIONS' {
    const type = (productType || '').toUpperCase();
    
    if (productType === 'NFO-OPT' || type.includes('OPT')) {
      return 'OPTIONS';
    }
    
    if (productType === 'NFO-FUT' || type.includes('FUT')) {
      return 'FUTURES';
    }
    
    return 'STOCK';
  }
} 