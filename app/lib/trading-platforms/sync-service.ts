import { prisma } from '../db';
import { TradingPlatformFactory, SupportedPlatform } from './factory';
import { PlatformTrade, PlatformCredentials } from './base';

export interface SyncOptions {
  startDate?: Date;
  endDate?: Date;
  forceFullSync?: boolean;
  updateExisting?: boolean;
}

export interface SyncResult {
  success: boolean;
  accountId: string;
  platform: string;
  tradesFetched: number;
  tradesCreated: number;
  tradesUpdated: number;
  tradesSkipped: number;
  errors: number;
  errorMessage?: string;
  errorDetails?: any;
  duration: number;
  platformTradeIds: string[];
}

export class TradingPlatformSyncService {
  static async syncAccount(accountId: string, options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      // For now, we'll work with a simplified approach using the existing account model
      // In the future, this will use the new TradingAccount model
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: { user: true }
      });

      if (!account) {
        return {
          success: false,
          accountId,
          platform: 'UNKNOWN',
          tradesFetched: 0,
          tradesCreated: 0,
          tradesUpdated: 0,
          tradesSkipped: 0,
          errors: 1,
          errorMessage: 'Account not found',
          duration: Date.now() - startTime,
          platformTradeIds: []
        };
      }

      // For demo purposes, we'll use a mock platform and credentials
      // In production, this would come from the TradingAccount model
      const mockPlatform = 'ANGEL_ONE' as SupportedPlatform;
      const mockCredentials: PlatformCredentials = {
        apiKey: 'demo_api_key',
        apiSecret: 'demo_api_secret'
      };

      // Create platform instance
      const platform = TradingPlatformFactory.createPlatform(mockPlatform, mockCredentials);

      // Fetch trades from platform
      const platformTrades = await platform.getTrades(options.startDate, options.endDate);

      // Process trades
      const result = await this.processTrades(
        accountId,
        account.userId,
        mockPlatform,
        platformTrades,
        options
      );

      return {
        ...result,
        accountId,
        platform: mockPlatform,
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.error('Sync failed for account:', accountId, error);
      
      return {
        success: false,
        accountId,
        platform: 'UNKNOWN',
        tradesFetched: 0,
        tradesCreated: 0,
        tradesUpdated: 0,
        tradesSkipped: 0,
        errors: 1,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
        duration: Date.now() - startTime,
        platformTradeIds: []
      };
    }
  }

  private static async processTrades(
    accountId: string,
    userId: string,
    platform: string,
    platformTrades: PlatformTrade[],
    options: SyncOptions
  ): Promise<Omit<SyncResult, 'accountId' | 'platform' | 'duration'>> {
    let tradesCreated = 0;
    let tradesUpdated = 0;
    let tradesSkipped = 0;
    let errors = 0;
    const platformTradeIds: string[] = [];

    for (const platformTrade of platformTrades) {
      try {
        platformTradeIds.push(platformTrade.id);

        // Check if trade already exists (using existing trade model)
        const existingTrade = await prisma.trade.findFirst({
          where: {
            userId,
            // Note: platformTradeId and platform fields will be available after migration
            // For now, we'll use symbol and entryDate as a simple check
            symbol: platformTrade.symbol,
            entryDate: new Date(platformTrade.entryDate)
          }
        });

        if (existingTrade && !options.updateExisting) {
          tradesSkipped++;
          continue;
        }

        // Prepare trade data (using existing trade model fields)
        const tradeData = {
          symbol: platformTrade.symbol,
          type: platformTrade.type,
          instrumentType: platformTrade.instrumentType,
          entryPrice: platformTrade.entryPrice,
          exitPrice: platformTrade.exitPrice,
          quantity: platformTrade.quantity,
          strikePrice: platformTrade.strikePrice,
          expiryDate: platformTrade.expiryDate ? new Date(platformTrade.expiryDate) : null,
          optionType: platformTrade.optionType,
          premium: platformTrade.premium,
          entryDate: new Date(platformTrade.entryDate),
          exitDate: platformTrade.exitDate ? new Date(platformTrade.exitDate) : null,
          profitLoss: platformTrade.profitLoss,
          // Note: platform-specific fields will be added after migration
          // platformTradeId: platformTrade.id,
          // platform,
          // accountId,
          // isSynced: true,
          // lastSyncAt: new Date(),
          userId
        };

        if (existingTrade) {
          // Update existing trade
          await prisma.trade.update({
            where: { id: existingTrade.id },
            data: tradeData
          });
          tradesUpdated++;
        } else {
          // Create new trade
          await prisma.trade.create({
            data: tradeData
          });
          tradesCreated++;
        }

      } catch (error) {
        console.error('Error processing trade:', platformTrade.id, error);
        errors++;
      }
    }

    return {
      success: errors === 0,
      tradesFetched: platformTrades.length,
      tradesCreated,
      tradesUpdated,
      tradesSkipped,
      errors,
      platformTradeIds
    };
  }

  static async syncAllAccounts(options: SyncOptions = {}): Promise<SyncResult[]> {
    // For now, we'll return an empty array since we don't have TradingAccount model yet
    // In the future, this will fetch all active trading accounts
    console.log('syncAllAccounts called - TradingAccount model not yet available');
    return [];
  }

  static async getSyncHistory(accountId: string, limit: number = 10) {
    // For now, we'll return an empty array since we don't have TradeSync model yet
    // In the future, this will fetch sync history from the TradeSync model
    console.log('getSyncHistory called - TradeSync model not yet available');
    return [];
  }

  static async getAccountStatus(accountId: string) {
    // For now, we'll return basic account info
    // In the future, this will include sync status from TradingAccount model
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        userId: true,
        provider: true,
        type: true
      }
    });

    return account ? {
      id: account.id,
      platform: account.provider,
      accountName: `${account.provider} Account`,
      isActive: true,
      syncStatus: 'PENDING',
      lastSyncAt: null
    } : null;
  }
} 