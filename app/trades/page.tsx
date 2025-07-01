'use client';

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from 'react';
import loadable from 'next/dynamic';
import { getTrades, createTrade, updateTrade, deleteTrade, TradeFormData } from '../actions/trade';
import { Trade } from '../types/Trade';

// Dynamically import heavy, client-only components to keep initial JS chunk small
const TradeForm = loadable(() => import('../components/TradeForm'), { ssr: false });
const TradeTable = loadable(() => import('../components/TradeTable'), { ssr: false });
const EnhancedCSVImport = loadable(() => import('../components/EnhancedCSVImport'), { ssr: false });
const TradeSummary = loadable(() => import('../components/TradeSummary'), { ssr: false });
const VirtualizedTradeTable = loadable(() => import('../components/VirtualizedTradeTable'), { ssr: false });

import CSVImport from '../components/CSVImport';
import { dashboardUpdater } from '../lib/trading-platforms/dashboard-updater';

// Helper function to safely convert to ISO string
function safeToISOString(date: any): string {
  return typeof date === 'object' && date !== null && 'toISOString' in date
    ? date.toISOString()
    : date;
}

// Helper function to format currency with 2 decimal places
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Improved helper function with debug logging
function convertDatesToISOString(obj: any) {
  const result = { ...obj };
  ['entryDate', 'exitDate', 'expiryDate'].forEach((key) => {
    if (result[key]) {
      result[key] = safeToISOString(result[key]);
    }
  });

  // Avoid expensive logging in production; minimal logging in dev
  if (process.env.NODE_ENV !== 'production') {
    if (typeof window !== 'undefined') {
      const win = window as any;
      win.__convertLogCount = (win.__convertLogCount || 0) + 1;
      if (win.__convertLogCount <= 3) {
        // eslint-disable-next-line no-console
        console.debug('[convertDatesToISOString] processed object', result);
      }
    }
  }

  return result;
}

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTrade, setEditTrade] = useState<{
    index: number | null;
    id: number | null;
    data?: TradeFormData;
  }>({
    index: null,
    id: null
  });
  const [showTradeDetails, setShowTradeDetails] = useState<boolean>(false);
  const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'LONG' | 'SHORT' | 'OPEN' | 'CLOSED' | 'WINNING' | 'LOSING'>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'symbol' | 'pnl'>('date');
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Move loadTrades outside useEffect so it can be called from event handler
  async function loadTrades() {
    try {
      setIsLoading(true);
      const data = await getTrades();
      setTrades(data.map(trade => convertDatesToISOString({
        ...trade,
        type: trade.type as 'LONG' | 'SHORT',
        instrumentType: trade.instrumentType as 'STOCK' | 'FUTURES' | 'OPTIONS'
      })));
      setError(null);
    } catch (err) {
      setError('Failed to load trades. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTrades();
  }, []);

  // Listen for dashboard sync events and reload trades
  useEffect(() => {
    function handleDashboardUpdate(event: any) {
      if (event.type === 'TRADE_SYNC' || event.type === 'PLATFORM_SYNC') {
        loadTrades();
      }
    }
    dashboardUpdater.registerComponent('trades-page', handleDashboardUpdate);
    return () => {
      dashboardUpdater.unregisterComponent('trades-page');
    };
  }, []);

  const handleSubmitTrade = async (data: TradeFormData) => {
    try {
      if (editTrade.id !== null) {
        // Edit existing trade
        await updateTrade(Number(editTrade.id), convertDatesToISOString(data));
        const updatedTrades = await getTrades();
        setTrades(updatedTrades.map(trade => convertDatesToISOString({
          ...trade,
          type: trade.type as 'LONG' | 'SHORT',
          instrumentType: trade.instrumentType as 'STOCK' | 'FUTURES' | 'OPTIONS'
        })));
        setEditTrade({
          index: null,
          id: null
        });
      } else {
        // Add new trade
        await createTrade(convertDatesToISOString(data));
        const updatedTrades = await getTrades();
        setTrades(updatedTrades.map(trade => convertDatesToISOString({
          ...trade,
          type: trade.type as 'LONG' | 'SHORT',
          instrumentType: trade.instrumentType as 'STOCK' | 'FUTURES' | 'OPTIONS'
        })));
        setShowAddForm(false);
      }
    } catch (err) {
      setError('Failed to save trade. Please try again.');
      console.error(err);
    }
  };

  const handleEditTrade = (index: number) => {
    const trade = trades[index];
    if (!trade || !trade.id) {
      console.error("Cannot edit trade: Invalid trade or missing ID", trade);
      return;
    }
    
    console.log("Editing trade:", trade);
    
    // Ensure dates are formatted as strings for the form
    const formattedTrade = {
      ...trade,
      entryDate: safeToISOString(trade.entryDate),
      exitDate: safeToISOString(trade.exitDate),
      expiryDate: safeToISOString(trade.expiryDate),
    };
    
    setEditTrade({
      index,
      id: trade.id,
      data: formattedTrade as TradeFormData
    });
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditTrade({
      index: null,
      id: null
    });
    setShowAddForm(false);
  };

  const handleDeleteTrade = async (index: number) => {
    if (!trades[index]?.id) return;
    
    const tradeSymbol = trades[index].symbol;
    const tradeId = trades[index].id;
    setIsDeleting(true);
    setError(null); // Clear any existing errors
    
    try {
      console.log(`Attempting to delete trade with ID: ${tradeId} (${tradeSymbol})`);
      await deleteTrade(tradeId!);
      console.log(`Successfully deleted trade with ID: ${tradeId}`);
      
      // Reload all trades from server instead of filtering locally
      console.log('Reloading trades from server...');
      const updatedTrades = await getTrades();
      console.log(`Loaded ${updatedTrades.length} trades after deletion`);
      
      setTrades(updatedTrades.map(trade => convertDatesToISOString({
        ...trade,
        type: trade.type as 'LONG' | 'SHORT',
        instrumentType: trade.instrumentType as 'STOCK' | 'FUTURES' | 'OPTIONS'
      })));
      
      // Show success message
      setDeleteMessage(`✅ Trade "${tradeSymbol}" deleted successfully! Total trades: ${updatedTrades.length}`);
      setTimeout(() => setDeleteMessage(null), 5000);
      
    } catch (error) {
      console.error("Error deleting trade:", error);
      setError(`Failed to delete trade "${tradeSymbol}". Please try again.`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewTradeDetails = (index: number) => {
    setSelectedTradeIndex(index);
    setShowTradeDetails(true);
  };
  
  const handleCloseTradeDetails = () => {
    setSelectedTradeIndex(null);
    setShowTradeDetails(false);
  };

  const handleImportTrades = async (importedTrades: TradeFormData[]) => {
    try {
      // Import each trade
      for (const trade of importedTrades) {
        try {
          console.log("Creating trade:", trade);
          await createTrade(convertDatesToISOString(trade));
        } catch (err) {
          console.error("Error creating trade:", trade, err);
          // Provide more specific error message
          if (err instanceof Error) {
            throw new Error(`Failed to create trade for ${trade.symbol}: ${err.message}`);
          } else {
            throw new Error(`Failed to create trade for ${trade.symbol}: Unknown error`);
          }
        }
      }
      
      // Refresh the trade list
      const updatedTrades = await getTrades();
      setTrades(updatedTrades.map(trade => convertDatesToISOString({
        ...trade,
        type: trade.type as 'LONG' | 'SHORT',
        instrumentType: trade.instrumentType as 'STOCK' | 'FUTURES' | 'OPTIONS'
      })));
      
      setImportMessage(`Successfully imported ${importedTrades.length} trades!`);
      setTimeout(() => setImportMessage(null), 4000);
    } catch (err) {
      console.error("Error in import process:", err);
      setError(`Failed to import trades: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Filter and sort trades (memoized)
  const filteredTrades = useMemo(() => {
    let filtered = trades;

    if (searchQuery.trim()) {
      filtered = filtered.filter(trade =>
        trade.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (trade.strategy && trade.strategy.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (trade.notes && trade.notes.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply type filter
    switch (filterType) {
      case 'LONG':
        filtered = filtered.filter(trade => trade.type === 'LONG');
        break;
      case 'SHORT':
        filtered = filtered.filter(trade => trade.type === 'SHORT');
        break;
      case 'OPEN':
        filtered = filtered.filter(trade => !trade.exitPrice);
        break;
      case 'CLOSED':
        filtered = filtered.filter(trade => trade.exitPrice);
        break;
      case 'WINNING':
        filtered = filtered.filter(trade => trade.profitLoss && trade.profitLoss > 0);
        break;
      case 'LOSING':
        filtered = filtered.filter(trade => trade.profitLoss && trade.profitLoss < 0);
        break;
    }

    // Apply sorting
    switch (sortBy) {
      case 'symbol':
        filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
        break;
      case 'pnl':
        filtered.sort((a, b) => {
          const aPnL = a.profitLoss || 0;
          const bPnL = b.profitLoss || 0;
          return bPnL - aPnL; // Descending order
        });
        break;
      case 'date':
      default:
        filtered.sort((a, b) => {
          const aDate = new Date(a.entryDate).getTime();
          const bDate = new Date(b.entryDate).getTime();
          return bDate - aDate; // Most recent first
        });
        break;
    }

    return filtered;
  }, [trades, searchQuery, filterType, sortBy]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent mb-3">
                Trading Journal
              </h1>
              <p className="text-gray-600 text-lg">Track, analyze, and improve your trading performance</p>
              
              {/* Quick Stats - Clickable */}
              <div className="flex flex-wrap gap-4 mt-4">
                <button
                  onClick={() => {
                    setFilterType('WINNING');
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 px-4 py-2 rounded-lg shadow-sm border border-green-200 hover:border-green-300 transition-all duration-200 hover:shadow-md cursor-pointer"
                >
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-700">
                    {trades.filter(t => t.profitLoss && t.profitLoss > 0).length} Winning Trades
                  </span>
                </button>
                
                <button
                  onClick={() => {
                    setFilterType('LOSING');
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 px-4 py-2 rounded-lg shadow-sm border border-red-200 hover:border-red-300 transition-all duration-200 hover:shadow-md cursor-pointer"
                >
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium text-red-700">
                    {trades.filter(t => t.profitLoss && t.profitLoss < 0).length} Losing Trades
                  </span>
                </button>
                
                <button
                  onClick={() => setFilterType('OPEN')}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 px-4 py-2 rounded-lg shadow-sm border border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md cursor-pointer"
                >
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-700">
                    {trades.filter(t => !t.exitPrice).length} Open Positions
                  </span>
                </button>
                
                <button
                  onClick={() => {
                    setFilterType('ALL');
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-slate-50 hover:from-gray-100 hover:to-slate-100 px-4 py-2 rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-md cursor-pointer"
                >
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">
                    {trades.length} Total Trades
                  </span>
                </button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <EnhancedCSVImport onImport={handleImportTrades} />
                
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 hover:scale-105"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add New Trade
                </button>
                {/* Refresh Button */}
                <button
                  onClick={loadTrades}
                  className="inline-flex items-center px-4 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all duration-200 shadow-md ml-2"
                  title="Refresh trades"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582M20 20v-5h-.581M5.635 19.364A9 9 0 104.582 9.582" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Messages */}
        {importMessage && (
          <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-800 px-6 py-4 rounded-lg shadow-sm">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{importMessage}</span>
            </div>
          </div>
        )}

        {deleteMessage && (
          <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-800 px-6 py-4 rounded-lg shadow-sm">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="font-medium">{deleteMessage}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg shadow-sm relative">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
            <button
              className="absolute top-2 right-2 p-2 hover:bg-red-100 rounded-lg transition-colors"
              onClick={() => setError(null)}
            >
              <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Trade Summary Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
            <div className="flex items-center mb-4">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Performance Overview</h2>
            </div>
            <TradeSummary trades={trades} />
          </div>
        </div>

        {/* Add/Edit Trade Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {editTrade.id ? 'Edit Trade' : 'Add New Trade'}
                  </h3>
                  <button
                    onClick={handleCancelEdit}
                    className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <TradeForm 
                  initialData={editTrade.data && editTrade.id ? {...editTrade.data, id: editTrade.id} : undefined}
                  onSuccess={() => {
                    // This function will be called after form submission
                    console.log("TradeForm success callback triggered");
                    // Refresh trades list
                    getTrades().then(updatedTrades => {
                      setTrades(updatedTrades.map(trade => convertDatesToISOString({
                        ...trade,
                        type: trade.type as 'LONG' | 'SHORT',
                        instrumentType: trade.instrumentType as 'STOCK' | 'FUTURES' | 'OPTIONS'
                      })));
                      
                      // Reset edit state
                      setEditTrade({
                        index: null,
                        id: null
                      });
                      setShowAddForm(false);
                    }).catch(err => {
                      console.error("Error refreshing trades after form submission:", err);
                    });
                  }}
                  onCancel={handleCancelEdit} 
                />
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by symbol, strategy, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors"
              >
                <option value="ALL">All Trades</option>
                <option value="WINNING">Winning Trades</option>
                <option value="LOSING">Losing Trades</option>
                <option value="OPEN">Open Positions</option>
                <option value="CLOSED">Closed Trades</option>
                <option value="LONG">Long Only</option>
                <option value="SHORT">Short Only</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors"
              >
                <option value="date">Sort by Date</option>
                <option value="symbol">Sort by Symbol</option>
                <option value="pnl">Sort by P&L</option>
              </select>
              
              {(searchQuery || filterType !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('ALL');
                    setSortBy('date');
                  }}
                  className="px-4 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300 flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear Filters
                </button>
              )}
            </div>
          </div>
          
          {/* Results count */}
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredTrades.length} of {trades.length} trades
          </div>
        </div>

        {/* Trade table section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Loading your trades...</p>
              </div>
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="text-center">
                <svg className="h-16 w-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {trades.length === 0 ? (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No trades yet</h3>
                    <p className="text-gray-500 mb-6">Start by adding your first trade or importing from CSV</p>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Your First Trade
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No trades match your filters</h3>
                    <p className="text-gray-500 mb-6">Try adjusting your search criteria or filters</p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setFilterType('ALL');
                        setSortBy('date');
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Clear all filters
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            filteredTrades.length > 300 ? (
              <VirtualizedTradeTable
                trades={filteredTrades}
                onEdit={handleEditTrade}
                onDelete={handleDeleteTrade}
                onViewDetails={handleViewTradeDetails}
                isDeleting={isDeleting}
              />
            ) : (
              <TradeTable
                trades={filteredTrades}
                onEdit={handleEditTrade}
                onDelete={handleDeleteTrade}
                onViewDetails={handleViewTradeDetails}
                isDeleting={isDeleting}
              />
            )
          )}
        </div>
        
        {/* Trade Details Modal */}
        {showTradeDetails && selectedTradeIndex !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        Trade Details: {trades[selectedTradeIndex].symbol}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {trades[selectedTradeIndex].type} • {trades[selectedTradeIndex].instrumentType}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseTradeDetails}
                    className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Trade Setup Screenshot */}
                <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6">
                  {trades[selectedTradeIndex].setupImageUrl ? (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Trade Setup
                      </h4>
                      <img 
                        src={trades[selectedTradeIndex].setupImageUrl} 
                        alt="Trade Setup" 
                        className="w-full rounded-xl border-2 border-gray-200 shadow-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/1200x800?text=Image+Not+Found';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-xl">
                      <div className="text-center">
                        <svg className="h-12 w-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="font-medium">No screenshot available</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Trade Information */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Trade Information
                  </h4>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Symbol</p>
                      <p className="font-bold text-lg text-gray-900">{trades[selectedTradeIndex].symbol}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Type</p>
                      <p className={`font-bold text-lg ${trades[selectedTradeIndex].type === 'LONG' ? 'text-green-600' : 'text-red-600'}`}>
                        {trades[selectedTradeIndex].type}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Strategy</p>
                      {trades[selectedTradeIndex].strategy ? (
                        <p className="font-bold text-lg text-gray-900">{trades[selectedTradeIndex].strategy}</p>
                      ) : (
                        <div className="flex items-center">
                          <span className="text-gray-400 font-medium">Not specified</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Time Frame</p>
                      <p className="font-bold text-lg text-gray-900">{trades[selectedTradeIndex].timeFrame || 'Not specified'}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-xs text-blue-600 uppercase tracking-wide font-medium mb-1">Entry Price</p>
                      <p className="font-bold text-lg text-blue-900">₹{formatCurrency(trades[selectedTradeIndex].entryPrice)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-xs text-blue-600 uppercase tracking-wide font-medium mb-1">Exit Price</p>
                      <p className="font-bold text-lg text-blue-900">
                        {trades[selectedTradeIndex].exitPrice 
                          ? `₹${formatCurrency(trades[selectedTradeIndex].exitPrice)}` 
                          : 'Not exited'}
                      </p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-4">
                      <p className="text-xs text-indigo-600 uppercase tracking-wide font-medium mb-1">Quantity</p>
                      <p className="font-bold text-lg text-indigo-900">{trades[selectedTradeIndex].quantity}</p>
                    </div>
                    <div className={`rounded-lg p-4 ${trades[selectedTradeIndex].profitLoss && trades[selectedTradeIndex].profitLoss > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${trades[selectedTradeIndex].profitLoss && trades[selectedTradeIndex].profitLoss > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Profit/Loss
                      </p>
                      <p className={`font-bold text-lg ${trades[selectedTradeIndex].profitLoss && trades[selectedTradeIndex].profitLoss > 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {trades[selectedTradeIndex].profitLoss 
                          ? `${trades[selectedTradeIndex].profitLoss > 0 ? '+' : ''}₹${formatCurrency(trades[selectedTradeIndex].profitLoss)}` 
                          : 'Pending'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Trade Analysis */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Trade Analysis
                  </h4>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-xs text-purple-600 uppercase tracking-wide font-medium mb-1">Risk-Reward</p>
                      <p className="font-bold text-lg text-purple-900">{trades[selectedTradeIndex].riskRewardRatio || 'Not set'}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <p className="text-xs text-orange-600 uppercase tracking-wide font-medium mb-1">Stop Loss</p>
                      <p className="font-bold text-lg text-orange-900">
                        {trades[selectedTradeIndex].stopLoss 
                          ? `₹${formatCurrency(trades[selectedTradeIndex].stopLoss)}` 
                          : 'Not set'}
                      </p>
                    </div>
                    <div className="bg-teal-50 rounded-lg p-4">
                      <p className="text-xs text-teal-600 uppercase tracking-wide font-medium mb-1">Target Price</p>
                      <p className="font-bold text-lg text-teal-900">
                        {trades[selectedTradeIndex].targetPrice 
                          ? `₹${formatCurrency(trades[selectedTradeIndex].targetPrice)}` 
                          : 'Not set'}
                      </p>
                    </div>
                    <div className="bg-pink-50 rounded-lg p-4">
                      <p className="text-xs text-pink-600 uppercase tracking-wide font-medium mb-1">Market Condition</p>
                      <p className="font-bold text-lg text-pink-900">{trades[selectedTradeIndex].marketCondition || 'Not specified'}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-xs text-yellow-600 uppercase tracking-wide font-medium mb-1">Pre-Trade Emotion</p>
                      <p className="font-bold text-lg text-yellow-900">{trades[selectedTradeIndex].preTradeEmotion || 'Not recorded'}</p>
                    </div>
                    <div className="bg-cyan-50 rounded-lg p-4">
                      <p className="text-xs text-cyan-600 uppercase tracking-wide font-medium mb-1">Post-Trade Emotion</p>
                      <p className="font-bold text-lg text-cyan-900">{trades[selectedTradeIndex].postTradeEmotion || 'Not recorded'}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4">
                      <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium mb-1">Confidence</p>
                      <div className="flex items-center">
                        {trades[selectedTradeIndex].tradeConfidence ? (
                          <div className="flex items-center">
                            <span className={`font-bold text-lg ${
                              trades[selectedTradeIndex].tradeConfidence >= 8 ? 'text-green-700' : 
                              trades[selectedTradeIndex].tradeConfidence >= 5 ? 'text-amber-600' : 
                              'text-red-700'
                            }`}>
                              {trades[selectedTradeIndex].tradeConfidence}
                            </span>
                            <span className="ml-1 text-gray-400 text-sm">/10</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-medium">Not rated</span>
                        )}
                      </div>
                    </div>
                    <div className="bg-violet-50 rounded-lg p-4">
                      <p className="text-xs text-violet-600 uppercase tracking-wide font-medium mb-1">Rating</p>
                      <div className="flex items-center">
                        {trades[selectedTradeIndex].tradeRating ? (
                          <div className="flex items-center">
                            <span className={`font-bold text-lg ${
                              trades[selectedTradeIndex].tradeRating >= 8 ? 'text-green-700' : 
                              trades[selectedTradeIndex].tradeRating >= 5 ? 'text-amber-600' : 
                              'text-red-700'
                            }`}>
                              {trades[selectedTradeIndex].tradeRating}
                            </span>
                            <span className="ml-1 text-gray-400 text-sm">/10</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-medium">Not rated</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Notes and Lessons */}
                {(trades[selectedTradeIndex].notes || trades[selectedTradeIndex].lessons) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Notes & Lessons
                    </h4>
                    
                    <div className="space-y-4">
                      {trades[selectedTradeIndex].notes && (
                        <div className="bg-blue-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-blue-800 mb-2">Trade Notes</p>
                          <p className="text-gray-700 leading-relaxed">{trades[selectedTradeIndex].notes}</p>
                        </div>
                      )}
                      
                      {trades[selectedTradeIndex].lessons && (
                        <div className="bg-green-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-800 mb-2">Lessons Learned</p>
                          <p className="text-gray-700 leading-relaxed">{trades[selectedTradeIndex].lessons}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 