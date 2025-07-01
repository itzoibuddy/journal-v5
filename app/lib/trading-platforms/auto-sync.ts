import { TradingPlatformSyncService, SyncOptions } from './sync-service';
import { TradingPlatformFactory, SupportedPlatform } from './factory';
import { PlatformTrade } from './base';
import { prisma } from '../db';
import { dashboardUpdater } from './dashboard-updater';
import type { Trade } from '@prisma/client';

export interface AutoSyncConfig {
  enabled: boolean;
  syncInterval: number; // in minutes
  platforms: {
    [key: string]: {
      enabled: boolean;
      credentials: any;
      lastSync?: Date;
      syncStatus: 'idle' | 'syncing' | 'success' | 'error';
    };
  };
  autoProcessTrades: boolean;
  updateDashboard: boolean;
}

export interface SyncResult {
  platform: string;
  success: boolean;
  tradesFetched: number;
  tradesProcessed: number;
  errors: number;
  message: string;
  timestamp: Date;
}

export class AutoSyncService {
  private static instance: AutoSyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private config: AutoSyncConfig = {
    enabled: false,
    syncInterval: 15, // 15 minutes
    platforms: {},
    autoProcessTrades: true,
    updateDashboard: true
  };

  private constructor() {}

  static getInstance(): AutoSyncService {
    if (!AutoSyncService.instance) {
      AutoSyncService.instance = new AutoSyncService();
    }
    return AutoSyncService.instance;
  }

  async start(config?: Partial<AutoSyncConfig>): Promise<void> {
    if (this.isRunning) {
      console.log('Auto-sync is already running');
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (!this.config.enabled) {
      console.log('Auto-sync is disabled');
      return;
    }

    this.isRunning = true;
    console.log(`Starting auto-sync with ${this.config.syncInterval} minute interval`);

    // Run initial sync
    await this.performAutoSync();

    // Schedule recurring sync
    this.syncInterval = setInterval(async () => {
      await this.performAutoSync();
    }, this.config.syncInterval * 60 * 1000);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    console.log('Auto-sync stopped');
  }

  private async performAutoSync(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const startTime = Date.now();

    console.log('Starting auto-sync for all connected platforms...');

    // Get all users with trading accounts (in the future, this will use TradingAccount model)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true
      }
    });

    for (const user of users) {
      try {
        // For each user, sync their connected platforms
        const userResults = await this.syncUserPlatforms(user.id);
        results.push(...userResults);
        // Trigger dashboard update for this user after syncing
        await dashboardUpdater.triggerUpdate({
          type: 'TRADE_SYNC',
          userId: String(user.id),
          data: {},
          timestamp: new Date()
        });
      } catch (error) {
        console.error(`Error syncing platforms for user ${user.email}:`, error);
        results.push({
          platform: 'UNKNOWN',
          success: false,
          tradesFetched: 0,
          tradesProcessed: 0,
          errors: 1,
          message: `Error syncing user platforms: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Auto-sync completed in ${duration}ms. Processed ${results.length} platform syncs.`);

    // Trigger dashboard updates if enabled (legacy/global)
    if (this.config.updateDashboard) {
      await this.triggerDashboardUpdates();
    }

    return results;
  }

  private async syncUserPlatforms(userId: string): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    // For now, we'll use a demo approach since TradingAccount model isn't available yet
    // In the future, this will fetch actual connected platforms for the user
    const demoPlatforms = [
      { platform: 'ANGEL_ONE' as SupportedPlatform, credentials: { apiKey: 'demo', apiSecret: 'demo' } },
      { platform: 'ZERODHA' as SupportedPlatform, credentials: { apiKey: 'demo', apiSecret: 'demo' } }
    ];

    for (const { platform, credentials } of demoPlatforms) {
      try {
        console.log(`Syncing ${platform} for user ${userId}...`);
        
        // Create platform instance
        const platformInstance = TradingPlatformFactory.createPlatform(platform, credentials);
        
        // Fetch trades from platform
        const platformTrades = await platformInstance.getTrades();
        
        // Process and store trades
        const processedTrades = await this.processAndStoreTrades(userId, platform, platformTrades);
        
        results.push({
          platform,
          success: true,
          tradesFetched: platformTrades.length,
          tradesProcessed: processedTrades.length,
          errors: 0,
          message: `Successfully synced ${platformTrades.length} trades`,
          timestamp: new Date()
        });

        console.log(`✓ ${platform}: ${platformTrades.length} trades processed`);

        // After processing trades for a user, trigger dashboard update
        await dashboardUpdater.triggerUpdate({
          type: 'TRADE_SYNC',
          userId,
          data: {}, // Optionally pass summary or trade IDs
          timestamp: new Date()
        });

      } catch (error) {
        console.error(`✗ ${platform} sync failed:`, error);
        results.push({
          platform,
          success: false,
          tradesFetched: 0,
          tradesProcessed: 0,
          errors: 1,
          message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        });
      }
    }

    return results;
  }

  private async processAndStoreTrades(userId: string, platform: string, platformTrades: PlatformTrade[]): Promise<Trade[]> {
    const processedTrades: Trade[] = [];

    for (const platformTrade of platformTrades) {
      try {
        // Check if trade already exists
        const existingTrade = await prisma.trade.findFirst({
          where: {
            userId,
            symbol: platformTrade.symbol,
            entryDate: new Date(platformTrade.entryDate)
          }
        });

        if (existingTrade) {
          // Update existing trade
          await prisma.trade.update({
            where: { id: existingTrade.id },
            data: {
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
              // Add platform-specific metadata
              notes: `Auto-synced from ${platform}`,
              strategy: this.autoDetectStrategy(platformTrade),
              sector: this.autoDetectSector(platformTrade.symbol),
              marketCondition: this.autoDetectMarketCondition(platformTrade),
              timeFrame: this.autoDetectTimeFrame(platformTrade),
              updatedAt: new Date()
            }
          });
        } else {
          // Create new trade
          const newTrade = await prisma.trade.create({
            data: {
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
              // Add platform-specific metadata
              notes: `Auto-synced from ${platform}`,
              strategy: this.autoDetectStrategy(platformTrade),
              sector: this.autoDetectSector(platformTrade.symbol),
              marketCondition: this.autoDetectMarketCondition(platformTrade),
              timeFrame: this.autoDetectTimeFrame(platformTrade),
              userId
            }
          });
          processedTrades.push(newTrade);
        }

        // After processing trades for a user, trigger dashboard update
        await dashboardUpdater.triggerUpdate({
          type: 'TRADE_SYNC',
          userId,
          data: {},
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Error processing trade:', platformTrade.id, error);
      }
    }

    return processedTrades;
  }

  private autoDetectStrategy(trade: PlatformTrade): string {
    // Auto-detect trading strategy based on trade characteristics
    if (trade.instrumentType === 'OPTIONS') {
      return 'Options Trading';
    } else if (trade.instrumentType === 'FUTURES') {
      return 'Futures Trading';
    } else if (trade.quantity > 1000) {
      return 'High Volume';
    } else if (trade.profitLoss && Math.abs(trade.profitLoss) > 10000) {
      return 'High Risk';
    } else {
      return 'Regular Trading';
    }
  }

  private autoDetectSector(symbol: string): string {
    // Auto-detect sector based on symbol (simplified)
    const sectorMap: { [key: string]: string } = {
      'RELIANCE': 'Oil & Gas',
      'TCS': 'IT',
      'INFY': 'IT',
      'HDFC': 'Banking',
      'ICICI': 'Banking',
      'SBI': 'Banking',
      'TATAMOTORS': 'Automobile',
      'MARUTI': 'Automobile',
      'BHARTI': 'Telecom',
      'ITC': 'FMCG'
    };

    return sectorMap[symbol] || 'Other';
  }

  private autoDetectMarketCondition(trade: PlatformTrade): string {
    // Auto-detect market condition based on trade timing and performance
    const hour = new Date(trade.entryDate).getHours();
    
    if (hour >= 9 && hour <= 11) {
      return 'Morning Session';
    } else if (hour >= 11 && hour <= 15) {
      return 'Mid Session';
    } else if (hour >= 15 && hour <= 16) {
      return 'Closing Session';
    } else {
      return 'Extended Hours';
    }
  }

  private autoDetectTimeFrame(trade: PlatformTrade): string {
    // Auto-detect time frame based on trade duration
    if (trade.exitDate) {
      const duration = new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime();
      const hours = duration / (1000 * 60 * 60);
      
      if (hours < 1) return 'Intraday';
      if (hours < 24) return 'Day Trading';
      if (hours < 168) return 'Swing Trading';
      return 'Positional';
    }
    return 'Open';
  }

  private async triggerDashboardUpdates(): Promise<void> {
    // This will trigger real-time updates to dashboard components
    // In a real implementation, this could use WebSockets or Server-Sent Events
    console.log('Triggering dashboard updates...');
    
    // For now, we'll just log the update
    // In the future, this could:
    // 1. Send WebSocket messages to connected clients
    // 2. Update cached data
    // 3. Trigger component re-renders
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    config: AutoSyncConfig;
    lastSyncTime?: Date;
  }> {
    return {
      isRunning: this.isRunning,
      config: this.config
    };
  }

  async updateConfig(config: Partial<AutoSyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Restart if currently running
    if (this.isRunning) {
      await this.stop();
      await this.start();
    }
  }

  async triggerManualSync(): Promise<SyncResult[]> {
    return await this.performAutoSync();
  }
}

// Export singleton instance
export const autoSyncService = AutoSyncService.getInstance(); 