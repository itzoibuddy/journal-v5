'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { dashboardUpdater, DashboardStats } from '../lib/trading-platforms/dashboard-updater';

interface PlatformStatus {
  platform: string;
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  lastSync: string;
  tradesCount: number;
  lastTrade: string;
}

interface LiveTrade {
  id: string;
  symbol: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  profitLoss: number;
  profitLossPercent: number;
  platform: string;
  timestamp: string;
}

export default function RealTimeTradingDashboard() {
  const { data: session } = useSession();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatus[]>([]);
  const [liveTrades, setLiveTrades] = useState<LiveTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const userId = (session?.user as any)?.id;

  useEffect(() => {
    if (!userId) return;

    // Load initial data
    loadDashboardData();
    loadPlatformStatuses();
    loadLiveTrades();

    // Set up real-time updates
    const interval = setInterval(() => {
      loadDashboardData();
      loadPlatformStatuses();
      loadLiveTrades();
      setLastUpdate(new Date());
    }, 30000); // Update every 30 seconds

    // Register for dashboard updates
    dashboardUpdater.registerComponent('real-time-dashboard', handleDashboardUpdate);

    return () => {
      clearInterval(interval);
      dashboardUpdater.unregisterComponent('real-time-dashboard');
    };
  }, [userId]);

  const handleDashboardUpdate = async (event: any) => {
    console.log('Real-time dashboard update:', event);
    if (event.type === 'TRADE_SYNC' || event.type === 'PLATFORM_SYNC') {
      await loadDashboardData();
      await loadPlatformStatuses();
      await loadLiveTrades();
      setLastUpdate(new Date());
    }
  };

  const loadDashboardData = async () => {
    try {
      const stats = await dashboardUpdater.getDashboardStats(userId, false);
      setDashboardStats(stats);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const loadPlatformStatuses = async () => {
    try {
      const response = await fetch('/api/trading-platforms/sync');
      if (response.ok) {
        const data = await response.json();
        const statuses: PlatformStatus[] = data.connectedPlatforms?.map((platform: any) => ({
          platform: platform.platform,
          status: platform.syncStatus.toLowerCase(),
          lastSync: platform.lastSyncAt || 'Never',
          tradesCount: 0, // Will be populated from stats
          lastTrade: 'N/A'
        })) || [];
        setPlatformStatuses(statuses);
      }
    } catch (error) {
      console.error('Error loading platform statuses:', error);
    }
  };

  const loadLiveTrades = async () => {
    try {
      const response = await fetch(`/api/trades?limit=10&live=true`);
      if (response.ok) {
        const result = await response.json();
        const trades = result.data || [];
        const liveTradesData: LiveTrade[] = trades.map((trade: any) => ({
          id: trade.id,
          symbol: trade.symbol,
          type: trade.type,
          entryPrice: trade.entryPrice,
          currentPrice: trade.exitPrice || trade.entryPrice,
          quantity: trade.quantity,
          profitLoss: trade.profitLoss || 0,
          profitLossPercent: trade.exitPrice ? ((trade.profitLoss || 0) / (trade.entryPrice * trade.quantity)) * 100 : 0,
          platform: trade.platform || 'Manual',
          timestamp: trade.updatedAt
        }));
        setLiveTrades(liveTradesData);
      }
    } catch (error) {
      console.error('Error loading live trades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const formatPercent = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'success':
        return 'text-green-600 bg-green-100';
      case 'syncing':
        return 'text-blue-600 bg-blue-100';
      case 'error':
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getProfitLossColor = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-gray-600">Loading real-time data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Real-Time Trading Dashboard</h2>
            <p className="text-gray-600 mt-1">Live trading data and platform integration status</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Last Updated</div>
            <div className="text-sm font-medium text-gray-900">
              {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total P&L</p>
                <p className={`text-2xl font-bold ${getProfitLossColor(dashboardStats.totalPL)}`}>
                  ₹{formatCurrency(dashboardStats.totalPL)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Win Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardStats.winRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Trades</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardStats.totalTrades}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Profit Factor</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardStats.profitFactor === Infinity ? '∞' : dashboardStats.profitFactor.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Platform Status */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Integration Status</h3>
        {platformStatuses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformStatuses.map((platform, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{platform.platform}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(platform.status)}`}>
                    {platform.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  <div>Last Sync: {platform.lastSync}</div>
                  <div>Trades: {platform.tradesCount}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-gray-500">No platforms connected</p>
            <p className="text-sm text-gray-400">Connect your trading platforms to see real-time data</p>
          </div>
        )}
      </div>

      {/* Live Trades */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Trades</h3>
        {liveTrades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entry Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    P&L
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Platform
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {liveTrades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{trade.symbol}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        trade.type === 'LONG' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{formatCurrency(trade.entryPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{formatCurrency(trade.currentPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getProfitLossColor(trade.profitLoss)}`}>
                        ₹{formatCurrency(trade.profitLoss)}
                      </div>
                      <div className={`text-xs ${getProfitLossColor(trade.profitLossPercent)}`}>
                        {formatPercent(trade.profitLossPercent)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {trade.platform}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-500">No trades found</p>
            <p className="text-sm text-gray-400">Start trading or sync your platforms to see data here</p>
          </div>
        )}
      </div>
    </div>
  );
} 