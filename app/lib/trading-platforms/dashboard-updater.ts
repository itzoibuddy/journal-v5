export interface DashboardUpdateEvent {
  type: 'TRADE_SYNC' | 'TRADE_UPDATE' | 'TRADE_DELETE' | 'PLATFORM_SYNC';
  userId: string;
  data: any;
  timestamp: Date;
}

export interface DashboardStats {
  totalTrades: number;
  totalPL: number;
  winRate: number;
  profitFactor: number;
  avgTrade: number;
  bestTrade: number;
  worstTrade: number;
  openTrades: number;
  closedTrades: number;
  syncedTrades: number;
  lastSyncTime?: Date;
}

export class DashboardUpdater {
  private static instance: DashboardUpdater;
  private updateCallbacks: Map<string, (event: DashboardUpdateEvent) => void> = new Map();
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): DashboardUpdater {
    if (!DashboardUpdater.instance) {
      DashboardUpdater.instance = new DashboardUpdater();
    }
    return DashboardUpdater.instance;
  }

  // Register a component for real-time updates
  registerComponent(componentId: string, callback: (event: DashboardUpdateEvent) => void): void {
    this.updateCallbacks.set(componentId, callback);
    console.log(`Registered dashboard component: ${componentId}`);
  }

  // Unregister a component
  unregisterComponent(componentId: string): void {
    this.updateCallbacks.delete(componentId);
    console.log(`Unregistered dashboard component: ${componentId}`);
  }

  // Trigger updates for all registered components
  async triggerUpdate(event: DashboardUpdateEvent): Promise<void> {
    console.log(`Triggering dashboard update: ${event.type} for user ${event.userId}`);
    
    // Update cache
    this.updateCache(event);
    
    // Notify all registered components
    for (const [componentId, callback] of this.updateCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error(`Error updating component ${componentId}:`, error);
      }
    }
  }

  // Get cached dashboard stats for a user
  async getDashboardStats(userId: string, forceRefresh = false): Promise<DashboardStats> {
    const cacheKey = `dashboard_stats_${userId}`;
    
    // Check cache first
    if (!forceRefresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // Fetch stats from API
      const response = await fetch(`/api/user/stats?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      
      const stats = await response.json();
      
      // Update cache
      this.cache.set(cacheKey, {
        data: stats,
        timestamp: Date.now()
      });

      return stats;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Return default stats if API call fails
      return {
        totalTrades: 0,
        totalPL: 0,
        winRate: 0,
        profitFactor: 0,
        avgTrade: 0,
        bestTrade: 0,
        worstTrade: 0,
        openTrades: 0,
        closedTrades: 0,
        syncedTrades: 0
      };
    }
  }

  // Get real-time trade updates
  async getRecentTrades(userId: string, limit = 10): Promise<any[]> {
    try {
      const response = await fetch(`/api/trades?userId=${userId}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch recent trades');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      return [];
    }
  }

  // Get platform-specific statistics
  async getPlatformStats(userId: string): Promise<any> {
    try {
      const response = await fetch(`/api/user/stats/platform?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch platform stats');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching platform stats:', error);
      return {};
    }
  }

  // Get performance trends
  async getPerformanceTrends(userId: string, days = 30): Promise<any[]> {
    try {
      const response = await fetch(`/api/user/stats/trends?userId=${userId}&days=${days}`);
      if (!response.ok) {
        throw new Error('Failed to fetch performance trends');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching performance trends:', error);
      return [];
    }
  }

  // Update cache with new event data
  private updateCache(event: DashboardUpdateEvent): void {
    const cacheKey = `dashboard_stats_${event.userId}`;
    
    // Invalidate cache for this user
    this.cache.delete(cacheKey);
    
    // Also clear related caches
    this.cache.delete(`recent_trades_${event.userId}`);
    this.cache.delete(`platform_stats_${event.userId}`);
  }

  // Clear all cached data
  clearCache(): void {
    this.cache.clear();
    console.log('Dashboard cache cleared');
  }

  // Get cache status for debugging
  getCacheStatus(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const dashboardUpdater = DashboardUpdater.getInstance(); 