import { TradingPlatformSyncService, SyncOptions, SyncResult } from './sync-service';

// Simple test to verify the service compiles correctly
describe('TradingPlatformSyncService', () => {
  it('should have the correct interface', () => {
    expect(typeof TradingPlatformSyncService.syncAccount).toBe('function');
    expect(typeof TradingPlatformSyncService.syncAllAccounts).toBe('function');
    expect(typeof TradingPlatformSyncService.getSyncHistory).toBe('function');
    expect(typeof TradingPlatformSyncService.getAccountStatus).toBe('function');
  });

  it('should handle sync options correctly', () => {
    const options: SyncOptions = {
      startDate: new Date(),
      endDate: new Date(),
      forceFullSync: true,
      updateExisting: false
    };

    expect(options.startDate).toBeInstanceOf(Date);
    expect(options.endDate).toBeInstanceOf(Date);
    expect(options.forceFullSync).toBe(true);
    expect(options.updateExisting).toBe(false);
  });

  it('should have correct SyncResult interface', () => {
    const result: SyncResult = {
      success: true,
      accountId: 'test-account',
      platform: 'ANGEL_ONE',
      tradesFetched: 10,
      tradesCreated: 5,
      tradesUpdated: 3,
      tradesSkipped: 2,
      errors: 0,
      duration: 1000,
      platformTradeIds: ['trade1', 'trade2']
    };

    expect(result.success).toBe(true);
    expect(result.accountId).toBe('test-account');
    expect(result.platform).toBe('ANGEL_ONE');
    expect(result.tradesFetched).toBe(10);
  });
}); 