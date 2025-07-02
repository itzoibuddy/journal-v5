'use client';

import React, { useState } from 'react';

interface DemoTrade {
  id: string;
  symbol: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  profitLoss: number;
  entryDate: string;
  platform: string;
}

const demoTrades: DemoTrade[] = [
  {
    id: 'T001',
    symbol: 'RELIANCE',
    type: 'LONG',
    entryPrice: 2450.50,
    exitPrice: 2480.75,
    quantity: 10,
    profitLoss: 302.50,
    entryDate: '2024-01-15T09:30:00Z',
    platform: 'Angel One'
  },
  {
    id: 'T002',
    symbol: 'TCS',
    type: 'SHORT',
    entryPrice: 3850.00,
    exitPrice: 3820.25,
    quantity: 5,
    profitLoss: 148.75,
    entryDate: '2024-01-15T10:15:00Z',
    platform: 'Zerodha'
  },
  {
    id: 'T003',
    symbol: 'INFY',
    type: 'LONG',
    entryPrice: 1520.80,
    exitPrice: 1545.90,
    quantity: 15,
    profitLoss: 376.50,
    entryDate: '2024-01-15T11:00:00Z',
    platform: 'Angel One'
  }
];

export default function TradingPlatformDemo() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncedTrades, setSyncedTrades] = useState<DemoTrade[]>([]);
  const [showResults, setShowResults] = useState(false);

  const simulateSync = async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncedTrades([]);
    setShowResults(false);

    // Simulate sync progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setSyncProgress(i);
    }

    // Simulate trade processing
    for (let i = 0; i < demoTrades.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setSyncedTrades(prev => [...prev, demoTrades[i]]);
    }

    setIsSyncing(false);
    setShowResults(true);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Trading Platform Integration Demo
        </h1>
        
        <p className="text-gray-600 mb-8">
          This demo shows how the trading platform integration works. Click the button below to simulate syncing trades from Angel One and Zerodha platforms.
        </p>

        {/* Demo Controls */}
        <div className="mb-8">
          <button
            onClick={simulateSync}
            disabled={isSyncing}
            className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSyncing ? 'Syncing...' : 'Start Demo Sync'}
          </button>
        </div>

        {/* Sync Progress */}
        {isSyncing && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Sync Progress</span>
              <span className="text-sm text-gray-500">{syncProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${syncProgress}%` }}
              ></div>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {syncProgress < 30 && 'Connecting to trading platforms...'}
              {syncProgress >= 30 && syncProgress < 60 && 'Authenticating...'}
              {syncProgress >= 60 && syncProgress < 90 && 'Fetching trade data...'}
              {syncProgress >= 90 && 'Processing trades...'}
            </div>
          </div>
        )}

        {/* Live Trade Processing */}
        {isSyncing && syncedTrades.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Trades</h3>
            <div className="space-y-2">
              {syncedTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-gray-900">{trade.symbol}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      trade.type === 'LONG' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {trade.type}
                    </span>
                    <span className="text-sm text-gray-600">{trade.platform}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      ₹{trade.profitLoss.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {trade.quantity} shares @ ₹{trade.entryPrice}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sync Results */}
        {showResults && (
          <div className="mb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">Sync Completed Successfully!</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-green-700">Trades Fetched:</span>
                  <span className="ml-2 text-green-800">{demoTrades.length}</span>
                </div>
                <div>
                  <span className="font-medium text-green-700">Platforms:</span>
                  <span className="ml-2 text-green-800">Angel One, Zerodha</span>
                </div>
                <div>
                  <span className="font-medium text-green-700">Total P&L:</span>
                  <span className="ml-2 text-green-800">
                    ₹{demoTrades.reduce((sum, trade) => sum + trade.profitLoss, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Features Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Supported Platforms</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Angel One (Angel Broking)
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Zerodha Kite
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                Upstox (Coming Soon)
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                5paisa (Coming Soon)
              </li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Key Features</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Real-time trade synchronization
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Secure credential storage
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Automatic duplicate detection
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Background sync scheduling
              </li>
            </ul>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Ready to Get Started?</h3>
          <p className="text-blue-800 text-sm mb-3">
            Connect your trading platforms to automatically sync your trade data and keep your journal up to date.
          </p>
          <a
            href="/brokers"
            className="inline-block bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Connect Your Platforms →
          </a>
        </div>
      </div>
    </div>
  );
} 