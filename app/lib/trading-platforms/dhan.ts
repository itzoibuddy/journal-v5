import { BaseTradingPlatform, PlatformCredentials, PlatformTrade } from './base';

export class DhanPlatform extends BaseTradingPlatform {
  private accessToken: string;
  private refreshTokenValue: string;

  constructor(credentials: PlatformCredentials) {
    super({ baseUrl: 'https://api.dhan.co', timeout: 10000 }, credentials);
    this.accessToken = credentials.accessToken || '';
    this.refreshTokenValue = credentials.refreshToken || '';
  }

  async authenticate(): Promise<boolean> {
    try {
      if (!this.accessToken) {
        throw new Error('Access token is required for Dhan authentication. Please connect your Dhan account first.');
      }

      // Test the token by making a simple API call
      const response = await this.makeRequest('/user/profile', 'GET');
      return response && response.data;
    } catch (error) {
      console.error('Dhan authentication failed:', error);
      return false;
    }
  }

  async getTrades(startDate?: Date, endDate?: Date): Promise<PlatformTrade[]> {
    try {
      let url = '/orders';
      const params = new URLSearchParams();
      
      if (startDate) {
        params.append('fromDate', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        params.append('toDate', endDate.toISOString().split('T')[0]);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await this.makeRequest(url, 'GET');
      if (!response || !response.data) {
        return [];
      }

      return response.data.map((trade: any) => ({
        id: trade.orderId || trade.tradeId,
        symbol: trade.symbol || trade.tradingSymbol,
        type: trade.side?.toLowerCase() === 'buy' ? 'LONG' : 'SHORT',
        instrumentType: 'STOCK',
        entryPrice: parseFloat(trade.price) || 0,
        quantity: parseInt(trade.quantity) || 0,
        entryDate: new Date(trade.orderTime || trade.tradeTime).toISOString(),
        orderId: trade.orderId,
        tradeId: trade.tradeId,
        status: trade.status || 'COMPLETE'
      }));
    } catch (error) {
      console.error('Error fetching Dhan trades:', error);
      return [];
    }
  }

  async getTradeHistory(symbol?: string, startDate?: Date, endDate?: Date): Promise<PlatformTrade[]> {
    try {
      let url = '/orders';
      const params = new URLSearchParams();
      
      if (symbol) {
        params.append('symbol', symbol);
      }
      if (startDate) {
        params.append('fromDate', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        params.append('toDate', endDate.toISOString().split('T')[0]);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await this.makeRequest(url, 'GET');
      if (!response || !response.data) {
        return [];
      }

      return response.data.map((trade: any) => ({
        id: trade.orderId || trade.tradeId,
        symbol: trade.symbol || trade.tradingSymbol,
        type: trade.side?.toLowerCase() === 'buy' ? 'LONG' : 'SHORT',
        instrumentType: 'STOCK',
        entryPrice: parseFloat(trade.price) || 0,
        quantity: parseInt(trade.quantity) || 0,
        entryDate: new Date(trade.orderTime || trade.tradeTime).toISOString(),
        orderId: trade.orderId,
        tradeId: trade.tradeId,
        status: trade.status || 'COMPLETE'
      }));
    } catch (error) {
      console.error('Error fetching Dhan trade history:', error);
      return [];
    }
  }

  async getAccountInfo(): Promise<any> {
    try {
      const profileResponse = await this.makeRequest('/user/profile', 'GET');
      const holdingsResponse = await this.makeRequest('/holdings', 'GET');
      
      return {
        profile: profileResponse?.data,
        holdings: holdingsResponse?.data,
        platform: 'DHAN'
      };
    } catch (error) {
      console.error('Error fetching Dhan account info:', error);
      return null;
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      if (!this.refreshTokenValue) {
        throw new Error('Refresh token not available');
      }

      // For OAuth refresh, we need the application's client credentials
      const clientId = process.env.DHAN_CLIENT_ID;
      const clientSecret = process.env.DHAN_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('Dhan application credentials not configured');
      }

      const response = await fetch('https://api.dhan.co/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.refreshTokenValue,
          client_id: clientId,
          client_secret: clientSecret
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
      console.error('Error refreshing Dhan token:', error);
      return false;
    }
  }

  protected async makeRequest(endpoint: string, method: string, data?: any): Promise<any> {
    try {
      const url = `${this.config.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.accessToken}`,
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

      const response = await fetch(url, options);

      if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry the request with new token
          headers.Authorization = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(url, { ...options, headers });
          if (!retryResponse.ok) {
            throw new Error(`Dhan API error: ${retryResponse.status} ${retryResponse.statusText}`);
          }
          return await retryResponse.json();
        } else {
          throw new Error('Token refresh failed');
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Dhan API error:', errorData);
        throw new Error(`Dhan API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Dhan API request failed:', error);
      throw error;
    }
  }
} 