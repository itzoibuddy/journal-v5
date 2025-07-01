'use client';

import { useState } from 'react';
import { Trade } from '../types/Trade';

interface TradeSummaryProps {
  trades: Trade[];
}

export default function TradeSummary({ trades }: TradeSummaryProps) {
  const [timeFrame, setTimeFrame] = useState<'all' | 'week' | 'month' | 'year'>('month');
  
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
  
  // Calculate analytics
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
  
  return (
    <div className="bg-white shadow rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Trading Performance</h2>
        
        <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1 sm:flex-nowrap">
          <button
            className={`px-2 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all duration-200 whitespace-nowrap ${
              timeFrame === 'week' 
                ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-indigo-200' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setTimeFrame('week')}
          >
            Week
          </button>
          <button
            className={`px-2 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all duration-200 whitespace-nowrap ${
              timeFrame === 'month' 
                ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-indigo-200' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setTimeFrame('month')}
          >
            Month
          </button>
          <button
            className={`px-2 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all duration-200 whitespace-nowrap ${
              timeFrame === 'year' 
                ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-indigo-200' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setTimeFrame('year')}
          >
            Year
          </button>
          <button
            className={`px-2 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all duration-200 whitespace-nowrap ${
              timeFrame === 'all' 
                ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-indigo-200' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setTimeFrame('all')}
          >
            All
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total P&L */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total P&L</p>
          <p className={`text-2xl font-bold ${totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalPL >= 0 ? '+' : ''}₹{formatCurrency(totalPL)}
          </p>
        </div>
        
        {/* Win Rate */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Win Rate</p>
          <p className={`text-2xl font-bold ${winRate >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
            {winRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {winningTrades} wins, {losingTrades} losses
          </p>
        </div>
        
        {/* Profit Factor */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Profit Factor</p>
          <p className={`text-2xl font-bold ${profitFactor >= 1.5 ? 'text-green-600' : profitFactor >= 1 ? 'text-amber-600' : 'text-red-600'}`}>
            {profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Win ₹{formatCurrency(avgWinAmount)} / Loss ₹{formatCurrency(avgLossAmount)}
          </p>
        </div>
        
        {/* Total Trades */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Trades</p>
          <p className="text-2xl font-bold text-gray-800">{totalTrades}</p>
          <p className="text-xs text-gray-500 mt-1">
            {openTrades} open, {closedTrades} closed
          </p>
        </div>
      </div>
      
      {/* Additional Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Best Trade */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
          <h3 className="text-sm font-semibold text-green-700 mb-2">Best Trade</h3>
          <p className="text-lg font-bold text-green-600">
            {maxProfit > 0 ? `+₹${formatCurrency(maxProfit)}` : 'No profits yet'}
          </p>
        </div>
        
        {/* Worst Trade */}
        <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-lg p-4 border border-red-200">
          <h3 className="text-sm font-semibold text-red-700 mb-2">Worst Trade</h3>
          <p className="text-lg font-bold text-red-600">
            {maxLoss < 0 ? `₹${formatCurrency(maxLoss)}` : 'No losses yet'}
          </p>
        </div>
        
        {/* Average Trade */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-700 mb-2">Average Trade</h3>
          <p className={`text-lg font-bold ${avgPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {avgPL >= 0 ? '+' : ''}₹{formatCurrency(avgPL)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Per completed trade</p>
        </div>
      </div>
    </div>
  );
} 