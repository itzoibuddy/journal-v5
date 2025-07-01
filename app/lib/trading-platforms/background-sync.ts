import { TradingPlatformSyncService, SyncOptions } from './sync-service';

export interface BackgroundSyncConfig {
  enabled: boolean;
  intervalMinutes: number;
  syncOptions: SyncOptions;
  maxConcurrentSyncs: number;
}

export class BackgroundSyncService {
  private static instance: BackgroundSyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private config: BackgroundSyncConfig = {
    enabled: false,
    intervalMinutes: 30, // Default: sync every 30 minutes
    syncOptions: {
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      forceFullSync: false,
      updateExisting: true
    },
    maxConcurrentSyncs: 3
  };

  private constructor() {}

  static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  async start(config?: Partial<BackgroundSyncConfig>): Promise<void> {
    if (this.isRunning) {
      console.log('Background sync is already running');
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (!this.config.enabled) {
      console.log('Background sync is disabled');
      return;
    }

    this.isRunning = true;
    console.log(`Starting background sync with ${this.config.intervalMinutes} minute interval`);

    // Run initial sync
    await this.performSync();

    // Schedule recurring sync
    this.syncInterval = setInterval(async () => {
      await this.performSync();
    }, this.config.intervalMinutes * 60 * 1000);
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

    console.log('Background sync stopped');
  }

  private async performSync(): Promise<void> {
    try {
      console.log('Starting scheduled sync...');
      const startTime = Date.now();

      const results = await TradingPlatformSyncService.syncAllAccounts(this.config.syncOptions);
      
      const successCount = results.filter(r => r.success).length;
      const totalTrades = results.reduce((sum, r) => sum + r.tradesCreated + r.tradesUpdated, 0);
      
      console.log(`Sync completed in ${Date.now() - startTime}ms`);
      console.log(`Success: ${successCount}/${results.length} accounts`);
      console.log(`Total trades processed: ${totalTrades}`);

      // Log detailed results
      results.forEach(result => {
        if (result.success) {
          console.log(`✓ ${result.platform}: ${result.tradesCreated} created, ${result.tradesUpdated} updated`);
        } else {
          console.error(`✗ ${result.platform}: ${result.errorMessage}`);
        }
      });

    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    config: BackgroundSyncConfig;
    lastSyncTime?: Date;
  }> {
    return {
      isRunning: this.isRunning,
      config: this.config
    };
  }

  async updateConfig(config: Partial<BackgroundSyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Restart if currently running
    if (this.isRunning) {
      await this.stop();
      await this.start();
    }
  }

  async triggerManualSync(accountId?: string): Promise<void> {
    if (accountId) {
      // Sync specific account
      const result = await TradingPlatformSyncService.syncAccount(accountId, this.config.syncOptions);
      console.log(`Manual sync for account ${accountId}:`, result.success ? 'Success' : 'Failed');
    } else {
      // Sync all accounts
      await this.performSync();
    }
  }
}

// Export singleton instance
export const backgroundSyncService = BackgroundSyncService.getInstance(); 