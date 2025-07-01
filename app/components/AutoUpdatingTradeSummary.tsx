'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Trade } from '../types/Trade';
import { dashboardUpdater, DashboardStats, DashboardUpdateEvent } from '../lib/trading-platforms/dashboard-updater';

interface AutoUpdatingTradeSummaryProps {
  trades: Trade[];
  componentId?: string;
  userId?: string;
}

interface SummaryData {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  averageWin: number;
  averageLoss: number;
  // Data source breakdown
  manualTrades: number;
  syncedTrades: number;
  manualProfit: number;
  syncedProfit: number;
  manualWinRate: number;
  syncedWinRate: number;
  // Platform breakdown
  platforms: { platform: string; trades: number; profit: number; winRate: number }[];
}

export default function AutoUpdatingTradeSummary({ trades, componentId = 'trade-summary', userId }: AutoUpdatingTradeSummaryProps) {
  const { data: session } = useSession();
  const [timeFrame, setTimeFrame] = useState<'all' | 'week' | 'month' | 'year'>('month');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get user ID from props or session
  const currentUserId = userId || (session?.user as any)?.id;

  useEffect(() => {
    if (!currentUserId) return;

    // Register for real-time updates
    dashboardUpdater.registerComponent(componentId, handleDashboardUpdate);

    // Load initial dashboard stats
    loadDashboardStats();

    // Cleanup on unmount
    return () => {
      dashboardUpdater.unregisterComponent(componentId);
    };
  }, [currentUserId, componentId]);

  const handleDashboardUpdate = async (event: DashboardUpdateEvent) => {
    console.log(`TradeSummary received update: ${event.type}`);
    setLastUpdate(new Date());
    
    if (event.type === 'TRADE_SYNC' || event.type === 'PLATFORM_SYNC') {
      setSyncStatus('syncing');
      
      // Reload dashboard stats
      await loadDashboardStats();
      
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const loadDashboardStats = async () => {
    if (!currentUserId) return;

    try {
      setIsLoading(true);
      const stats = await dashboardUpdater.getDashboardStats(currentUserId, true);
      setDashboardStats(stats);

      // Fetch trade summary data
      await fetchTradeSummaryData();
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      setSyncStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTradeSummaryData = async () => {
    try {
      const response = await fetch('/api/trades');
      if (response.ok) {
        const result = await response.json();
        const trades: Trade[] = result.data || [];
        
        if (trades.length === 0) {
          setSummaryData(null);
          return;
        }

        const completedTrades = trades.filter(trade => trade.profitLoss !== null);
        const winningTrades = completedTrades.filter(trade => trade.profitLoss! > 0);
        const losingTrades = completedTrades.filter(trade => trade.profitLoss! < 0);

        const totalProfit = winningTrades.reduce((sum, trade) => sum + trade.profitLoss!, 0);
        const totalLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.profitLoss!, 0));
        const netProfit = totalProfit - totalLoss;
        const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;
        const averageWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
        const averageLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;

        // Data source breakdown
        const manualTrades = trades.filter(trade => !trade.isSynced);
        const syncedTrades = trades.filter(trade => trade.isSynced);
        const completedManual = manualTrades.filter(trade => trade.profitLoss !== null);
        const completedSynced = syncedTrades.filter(trade => trade.profitLoss !== null);
        
        const manualProfit = completedManual.reduce((sum, trade) => sum + trade.profitLoss!, 0);
        const syncedProfit = completedSynced.reduce((sum, trade) => sum + trade.profitLoss!, 0);
        
        const manualWinningTrades = completedManual.filter(trade => trade.profitLoss! > 0);
        const syncedWinningTrades = completedSynced.filter(trade => trade.profitLoss! > 0);
        
        const manualWinRate = completedManual.length > 0 ? (manualWinningTrades.length / completedManual.length) * 100 : 0;
        const syncedWinRate = completedSynced.length > 0 ? (syncedWinningTrades.length / completedSynced.length) * 100 : 0;

        // Platform breakdown
        const platformMap = new Map<string, { trades: number; profit: number; wins: number; total: number }>();
        
        completedTrades.forEach(trade => {
          const platform = trade.platform || 'Manual';
          const current = platformMap.get(platform) || { trades: 0, profit: 0, wins: 0, total: 0 };
          current.trades += 1;
          current.profit += trade.profitLoss!;
          current.total += 1;
          if (trade.profitLoss! > 0) {
            current.wins += 1;
          }
          platformMap.set(platform, current);
        });

        const platforms = Array.from(platformMap.entries()).map(([platform, data]) => ({
          platform,
          trades: data.trades,
          profit: data.profit,
          winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0
        })).sort((a, b) => b.profit - a.profit);

        setSummaryData({
          totalTrades: completedTrades.length,
          winningTrades: winningTrades.length,
          losingTrades: losingTrades.length,
          winRate,
          totalProfit,
          totalLoss,
          netProfit,
          averageWin,
          averageLoss,
          manualTrades: completedManual.length,
          syncedTrades: completedSynced.length,
          manualProfit,
          syncedProfit,
          manualWinRate,
          syncedWinRate,
          platforms
        });
      } else {
        setError('Failed to fetch trades');
      }
    } catch (err) {
      setError('Error loading trade data');
      console.error('Error fetching trades:', err);
    }
  };

  // Helper function to filter trades by time frame
  const filterTradesByTimeFrame = (trades: Trade[], timeFrame: 'all' | 'week' | 'month' | 'year') => {
    if (timeFrame === 'all') return trades;
    
    const now = new Date();
    const cutoffDate = new Date();
    
    if (timeFrame === 'week') {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (timeFrame === 'month') {
      cutoffDate.setMonth(now.getMonth() - 1);
    } else if (timeFrame === 'year') {
      cutoffDate.setFullYear(now.getFullYear() - 1);
    }
    
    return trades.filter(trade => new Date(trade.entryDate) >= cutoffDate);
  };
  
  // Filter trades based on selected time frame
  const filteredTrades = filterTradesByTimeFrame(trades, timeFrame);
  
  // Calculate analytics from filtered trades
  const totalTrades = filteredTrades.length;
  const closedTrades = filteredTrades.filter(trade => trade.exitPrice !== null && trade.exitPrice !== undefined).length;
  const openTrades = totalTrades - closedTrades;
  
  // Calculate P&L stats
  const totalPL = filteredTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
  const winningTrades = filteredTrades.filter(trade => (trade.profitLoss || 0) > 0).length;
  const losingTrades = filteredTrades.filter(trade => (trade.profitLoss || 0) < 0).length;
  const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
  
  // Calculate average P&L
  const avgPL = closedTrades > 0 ? totalPL / closedTrades : 0;
  const avgWinAmount = winningTrades > 0 
    ? filteredTrades.filter(trade => (trade.profitLoss || 0) > 0).reduce((sum, trade) => sum + (trade.profitLoss || 0), 0) / winningTrades 
    : 0;
  const avgLossAmount = losingTrades > 0 
    ? Math.abs(filteredTrades.filter(trade => (trade.profitLoss || 0) < 0).reduce((sum, trade) => sum + (trade.profitLoss || 0), 0) / losingTrades)
    : 0;
  
  // Calculate profit factor
  const grossProfit = filteredTrades.filter(trade => (trade.profitLoss || 0) > 0).reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
  const grossLoss = Math.abs(filteredTrades.filter(trade => (trade.profitLoss || 0) < 0).reduce((sum, trade) => sum + (trade.profitLoss || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  
  // Calculate best and worst trades
  const completedTrades = filteredTrades.filter(trade => trade.profitLoss !== null && trade.profitLoss !== undefined);
  const maxProfit = completedTrades.length > 0 ? Math.max(...completedTrades.map(trade => trade.profitLoss || 0)) : 0;
  const maxLoss = completedTrades.length > 0 ? Math.min(...completedTrades.map(trade => trade.profitLoss || 0)) : 0;
  
  // Helper function to format currency with 2 decimal places
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Format last update time
  const formatLastUpdate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-red-600 text-center">
          <svg className="h-8 w-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!summaryData) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Trade Summary</h3>
        <div className="text-center text-gray-500 py-8">
          <svg className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">No trades found</p>
          <p className="text-xs text-gray-400 mt-1">Add your first trade to see analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
        <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Trading Performance Summary
      </h3>

      {/* Overall Performance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg p-4 text-white">
          <p className="text-xs text-green-100">Net Profit</p>
          <p className="text-lg font-bold">₹{formatCurrency(summaryData.netProfit)}</p>
        </div>
        
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg p-4 text-white">
          <p className="text-xs text-blue-100">Win Rate</p>
          <p className="text-lg font-bold">{summaryData.winRate.toFixed(1)}%</p>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-4 text-white">
          <p className="text-xs text-purple-100">Total Trades</p>
          <p className="text-lg font-bold">{summaryData.totalTrades}</p>
        </div>
        
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg p-4 text-white">
          <p className="text-xs text-orange-100">Avg. Trade</p>
          <p className="text-lg font-bold">₹{formatCurrency(summaryData.totalTrades > 0 ? summaryData.netProfit / summaryData.totalTrades : 0)}</p>
        </div>
      </div>

      {/* Data Source Breakdown */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-800 mb-3">Data Source Analysis</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-800">Manual Trades</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {summaryData.manualTrades}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-blue-600">Profit:</span>
                <span className={`font-medium ${summaryData.manualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{formatCurrency(summaryData.manualProfit)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-600">Win Rate:</span>
                <span className="font-medium text-blue-800">{summaryData.manualWinRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-800">Synced Trades</span>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                {summaryData.syncedTrades}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Profit:</span>
                <span className={`font-medium ${summaryData.syncedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{formatCurrency(summaryData.syncedProfit)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Win Rate:</span>
                <span className="font-medium text-green-800">{summaryData.syncedWinRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Breakdown */}
      {summaryData.platforms.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-800 mb-3">Platform Performance</h4>
          <div className="space-y-2">
            {summaryData.platforms.slice(0, 3).map((platform, index) => (
              <div key={platform.platform} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-gray-400' : 'bg-orange-400'}`}></div>
                  <span className="text-sm font-medium text-gray-700">{platform.platform}</span>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-gray-600">{platform.trades} trades</span>
                  <span className={`font-medium ${platform.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{formatCurrency(platform.profit)}
                  </span>
                  <span className="text-gray-500">{platform.winRate.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 