'use client';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import Pagination from './Pagination';
import { Trade } from '../types/Trade';
import { getLotSize as getSymbolLotSize, parseNSEOptionsSymbol, isOptionsSymbol } from '../lib/symbolParser';

// Helper function to calculate lot size for a symbol (memoized)
const getLotSize = (symbol: string): number => {
  if (!symbol) return 1;
  
  // If it's an options symbol, parse it to get the underlying
  if (isOptionsSymbol(symbol)) {
    const parsed = parseNSEOptionsSymbol(symbol);
    if (parsed.isValid) {
      return getSymbolLotSize(parsed.underlying);
    }
  }
  
  // For direct underlying symbols or other cases
  return getSymbolLotSize(symbol);
};

// Memoized helper function to format quantity as lots for display
const formatQuantityAsLots = (quantity: number, symbol: string): string => {
  const lotSize = getLotSize(symbol);
  if (lotSize <= 1) return quantity.toString();
  
  const lots = Math.round((quantity / lotSize) * 100) / 100;
  return `${quantity} (${lots} lots)`;
};

// Memoized helper function to format currency with 2 decimal places
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Icon for trade type (LONG/SHORT)
const tradeTypeIcon = (type: 'LONG' | 'SHORT') =>
  type === 'LONG' ? (
    <svg className="h-5 w-5 text-green-500 inline-block mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
  ) : (
    <svg className="h-5 w-5 text-red-500 inline-block mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
  );

interface TradeTableProps {
  trades: Trade[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onViewDetails: (index: number) => void;
  isDeleting?: boolean;
}

// Memoized TradeRow component to prevent unnecessary re-renders
const TradeRow = memo(({ trade, index, visibleColumns, onEdit, onDelete, onViewDetails, showDeleteIndex, setShowDeleteIndex, isDeleting }: any) => {
  const handleEdit = useCallback(() => onEdit(index), [onEdit, index]);
  const handleDelete = useCallback(() => onDelete(index), [onDelete, index]);
  const handleViewDetails = useCallback(() => onViewDetails(index), [onViewDetails, index]);
  const handleShowDelete = useCallback(() => setShowDeleteIndex(index), [setShowDeleteIndex, index]);
  const handleCancelDelete = useCallback(() => setShowDeleteIndex(null), [setShowDeleteIndex]);

  return (
    <tr className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
      {visibleColumns.entryDate && (
        <td className="py-3 px-4 text-sm text-gray-700">
          {new Date(trade.entryDate).toLocaleDateString('en-IN')}
        </td>
      )}
      {visibleColumns.symbol && (
        <td className="py-3 px-4 text-sm font-medium text-gray-900">
          {trade.symbol}
        </td>
      )}
      {visibleColumns.type && (
        <td className="py-3 px-4 text-sm">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            trade.type === 'LONG' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {tradeTypeIcon(trade.type)}
            {trade.type}
          </span>
        </td>
      )}
      {visibleColumns.strategy && (
        <td className="py-3 px-4 text-sm text-gray-600">
          {trade.strategy || '-'}
        </td>
      )}
      {visibleColumns.entryPrice && (
        <td className="py-3 px-4 text-sm text-gray-700">
          ₹{formatCurrency(trade.entryPrice)}
        </td>
      )}
      {visibleColumns.exitPrice && (
        <td className="py-3 px-4 text-sm text-gray-700">
          {trade.exitPrice ? `₹${formatCurrency(trade.exitPrice)}` : '-'}
        </td>
      )}
      {visibleColumns.quantity && (
        <td className="py-3 px-4 text-sm text-gray-700">
          {formatQuantityAsLots(trade.quantity, trade.symbol)}
        </td>
      )}
      {visibleColumns.strikePrice && (
        <td className="py-3 px-4 text-sm text-gray-700">
          {trade.strikePrice ? `₹${formatCurrency(trade.strikePrice)}` : '-'}
        </td>
      )}
      {visibleColumns.profitLoss && (
        <td className="py-3 px-4 text-sm">
          <span className={`font-medium ${
            (trade.profitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            ₹{formatCurrency(trade.profitLoss)}
          </span>
        </td>
      )}
      {visibleColumns.rating && (
        <td className="py-3 px-4 text-sm text-gray-700">
          {trade.tradeRating ? (
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`text-sm ${
                    i < trade.tradeRating ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
          ) : '-'}
        </td>
      )}
      {visibleColumns.actions && (
        <td className="py-3 px-4 text-sm text-right">
          <div className="flex items-center justify-end space-x-2">
            {showDeleteIndex === index ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-red-600 hover:text-red-900 text-xs font-medium disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  onClick={handleCancelDelete}
                  className="text-gray-600 hover:text-gray-900 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={handleViewDetails}
                  className="text-blue-600 hover:text-blue-900 text-xs font-medium"
                >
                  View
                </button>
                <button
                  onClick={handleEdit}
                  className="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={handleShowDelete}
                  className="text-red-600 hover:text-red-900 text-xs font-medium"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  );
});

export default function TradeTable({ trades, onEdit, onDelete, onViewDetails, isDeleting = false }: TradeTableProps) {
  const [showDeleteIndex, setShowDeleteIndex] = useState<number | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<{[key: string]: boolean}>({
    entryDate: true,
    symbol: true,
    type: true,
    strategy: true,
    entryPrice: true,
    exitPrice: true,
    quantity: true,
    strikePrice: false,
    profitLoss: true,
    rating: true,
    actions: true
  });
  
  const [showColumnSelector, setShowColumnSelector] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [tradesPerPage] = useState<number>(10);
  
  // Reference for the column selector dropdown
  const columnSelectorRef = useRef<HTMLDivElement>(null);
  
  // Close the column selector when clicking outside (memoized)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Memoized pagination calculations
  const paginationData = useMemo(() => {
    const indexOfLastTrade = currentPage * tradesPerPage;
    const indexOfFirstTrade = indexOfLastTrade - tradesPerPage;
    const currentTrades = trades.slice(indexOfFirstTrade, indexOfLastTrade);
    const totalPages = Math.ceil(trades.length / tradesPerPage);
    
    return { currentTrades, totalPages, indexOfFirstTrade };
  }, [trades, currentPage, tradesPerPage]);

  // Memoized callback functions
  const paginate = useCallback((pageNumber: number) => setCurrentPage(pageNumber), []);
  
  const toggleColumn = useCallback((column: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  }, []);
  
  const resetColumns = useCallback(() => {
    setVisibleColumns({
      entryDate: true,
      symbol: true,
      type: true,
      strategy: true,
      entryPrice: true,
      exitPrice: true,
      quantity: true,
      strikePrice: false,
      profitLoss: true,
      rating: true,
      actions: true
    });
  }, []);

  return (
    <div className="bg-white shadow rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Trades</h2>
      
      {trades.length === 0 ? (
        <div className="text-center py-4 text-gray-500">No trades found. Add your first trade above.</div>
      ) : (
        <div>
          {/* Column selector */}
          <div className="mb-4 flex justify-between items-center">
            <div className="flex items-center">
              <button 
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="flex items-center px-3 py-1 bg-white text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300 transition-colors text-xs font-medium"
              >
                <svg className="h-4 w-4 mr-1 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
                Columns
              </button>
              
              {showColumnSelector && (
                <div ref={columnSelectorRef} className="absolute mt-2 ml-0 z-10 bg-white shadow-lg rounded-md border border-gray-200 p-3 w-64">
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                    <h3 className="text-sm font-semibold">Show/Hide Columns</h3>
                    <button 
                      onClick={resetColumns}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center text-sm">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.entryDate} 
                        onChange={() => toggleColumn('entryDate')}
                        className="mr-2 h-4 w-4 text-indigo-600"
                      />
                      Entry Date
                    </label>
                    <label className="flex items-center text-sm">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.symbol} 
                        onChange={() => toggleColumn('symbol')}
                        className="mr-2 h-4 w-4 text-indigo-600"
                      />
                      Symbol
                    </label>
                    <label className="flex items-center text-sm">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.type} 
                        onChange={() => toggleColumn('type')}
                        className="mr-2 h-4 w-4 text-indigo-600"
                      />
                      Type
                    </label>
                    <label className="flex items-center text-sm">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.strategy} 
                        onChange={() => toggleColumn('strategy')}
                        className="mr-2 h-4 w-4 text-indigo-600"
                      />
                      Strategy
                    </label>
                    <label className="flex items-center text-sm">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.entryPrice} 
                        onChange={() => toggleColumn('entryPrice')}
                        className="mr-2 h-4 w-4 text-indigo-600"
                      />
                      Entry Price
                    </label>
                    <label className="flex items-center text-sm">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.exitPrice} 
                        onChange={() => toggleColumn('exitPrice')}
                        className="mr-2 h-4 w-4 text-indigo-600"
                      />
                      Exit Price
                    </label>
                    <label className="flex items-center text-sm">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.quantity} 
                        onChange={() => toggleColumn('quantity')}
                        className="mr-2 h-4 w-4 text-indigo-600"
                      />
                      Quantity
                    </label>
                    <label className="flex items-center text-sm">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.strikePrice} 
                        onChange={() => toggleColumn('strikePrice')}
                        className="mr-2 h-4 w-4 text-indigo-600"
                      />
                      Strike Price
                    </label>
                    <label className="flex items-center text-sm">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.profitLoss} 
                        onChange={() => toggleColumn('profitLoss')}
                        className="mr-2 h-4 w-4 text-indigo-600"
                      />
                      P/L
                    </label>
                    <label className="flex items-center text-sm">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.rating} 
                        onChange={() => toggleColumn('rating')}
                        className="mr-2 h-4 w-4 text-indigo-600"
                      />
                      Rating
                    </label>
                    <label className="flex items-center text-sm">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.actions} 
                        onChange={() => toggleColumn('actions')}
                        className="mr-2 h-4 w-4 text-indigo-600"
                      />
                      Actions
                    </label>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-200 flex justify-end">
                    <button
                      onClick={() => setShowColumnSelector(false)}
                      className="px-3 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
              
              <span className="ml-4 text-sm text-gray-500">
                Showing {paginationData.indexOfFirstTrade + 1}-{Math.min(paginationData.indexOfFirstTrade + tradesPerPage, trades.length)} of {trades.length} trades
              </span>
            </div>
            
            <div className="text-sm text-gray-500 flex items-center">
              <button 
                className="px-2 py-1 bg-white border border-gray-200 rounded-l-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300 transition-colors"
                onClick={() => {
                  const tableContainer = document.querySelector('.overflow-x-auto');
                  if (tableContainer) {
                    tableContainer.scrollLeft -= 200;
                  }
                }}
              >
                <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="px-3 py-1 bg-gray-50 border-t border-b border-gray-200 text-gray-600 font-medium text-xs">Scroll</span>
              <button 
                className="px-2 py-1 bg-white border border-gray-200 rounded-r-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300 transition-colors"
                onClick={() => {
                  const tableContainer = document.querySelector('.overflow-x-auto');
                  if (tableContainer) {
                    tableContainer.scrollLeft += 200;
                  }
                }}
              >
                <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-lg">
            <div className="min-w-full">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-slate-50 sticky top-0">
                  <tr>
                    {visibleColumns.entryDate && (
                      <th className="sticky left-0 z-10 bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider border-r border-indigo-200">
                        📅 Entry Date
                      </th>
                    )}
                    {visibleColumns.symbol && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        🏷️ Symbol
                      </th>
                    )}
                    {visibleColumns.type && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        📈 Type
                      </th>
                    )}
                    {visibleColumns.strategy && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        🎯 Strategy
                      </th>
                    )}
                    {visibleColumns.entryPrice && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        💰 Entry Price
                      </th>
                    )}
                    {visibleColumns.exitPrice && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        💸 Exit Price
                      </th>
                    )}
                    {visibleColumns.quantity && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        📊 Quantity
                      </th>
                    )}
                    {visibleColumns.strikePrice && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        🎢 Strike Price
                      </th>
                    )}
                    {visibleColumns.profitLoss && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        💹 P/L
                      </th>
                    )}
                    {visibleColumns.rating && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        ⭐ Rating
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        ⚡ Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginationData.currentTrades.map((trade, index) => {
                    const isProfit = trade.profitLoss && trade.profitLoss > 0;
                    const isLoss = trade.profitLoss && trade.profitLoss < 0;
                    
                    return (
                    <tr
                      key={trade.id || index}
                      className={`transition-all duration-200 hover:bg-gradient-to-r hover:shadow-md ${
                        isProfit 
                          ? 'hover:from-green-50 hover:to-emerald-50 hover:border-l-4 hover:border-green-400' 
                          : isLoss 
                            ? 'hover:from-red-50 hover:to-pink-50 hover:border-l-4 hover:border-red-400'
                            : 'hover:from-blue-50 hover:to-indigo-50 hover:border-l-4 hover:border-blue-400'
                      } ${
                        index % 2 === 0
                          ? 'bg-white'
                          : 'bg-gray-50'
                      }`}
                    >
                    
                      {visibleColumns.entryDate && (
                        <td className="sticky left-0 z-10 px-6 py-4 whitespace-nowrap text-sm font-medium bg-inherit border-r border-indigo-200">
                          <div className="flex flex-col">
                            <span className="text-gray-900 font-semibold">
                              {new Date(trade.entryDate).toLocaleDateString('en-IN', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric'
                              })}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(trade.entryDate).toLocaleTimeString('en-IN', { 
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.symbol && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {trade.symbol}
                          {trade.instrumentType === 'OPTIONS' && (
                            <span className="ml-1 text-xs text-gray-500">
                              {trade.optionType} {trade.strikePrice && `@ ₹${trade.strikePrice.toLocaleString('en-US')}`}
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.type && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            trade.type === 'LONG' 
                              ? 'bg-green-100 text-green-800 border border-green-200' 
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {tradeTypeIcon(trade.type)}
                            <span className="ml-1">{trade.type}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.strategy && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {trade.strategy ? (
                            trade.strategy
                          ) : (
                            <div className="flex items-center">
                              <span className="text-gray-400">-</span>
                              <svg className="h-5 w-5 text-red-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs text-red-500 ml-1">No setup</span>
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.entryPrice && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          ₹{formatCurrency(trade.entryPrice)}
                        </td>
                      )}
                      {visibleColumns.exitPrice && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {trade.exitPrice ? `₹${formatCurrency(trade.exitPrice)}` : '-'}
                        </td>
                      )}
                      {visibleColumns.quantity && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {formatQuantityAsLots(trade.quantity, trade.symbol)}
                        </td>
                      )}
                      {visibleColumns.strikePrice && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {trade.instrumentType === 'OPTIONS' && trade.strikePrice ? 
                            <span className="font-semibold text-indigo-700">₹{formatCurrency(trade.strikePrice)}</span> : '-'}
                        </td>
                      )}
                      {visibleColumns.profitLoss && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          {trade.profitLoss ? (
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              trade.profitLoss > 0 
                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {trade.profitLoss > 0 ? '📈 +' : '📉 '}₹{formatCurrency(trade.profitLoss)}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              ⏳ Pending
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.rating && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {trade.tradeRating ? (
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              trade.tradeRating >= 8 ? 'bg-green-100 text-green-800 border border-green-200' : 
                              trade.tradeRating >= 5 ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 
                              'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {'⭐'.repeat(Math.min(Math.floor(trade.tradeRating / 2), 5))} {trade.tradeRating}/10
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              ❓ Not rated
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              className="inline-flex items-center px-3 py-1.5 text-xs bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 border border-indigo-200 rounded-lg transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5"
                              onClick={() => onEdit(paginationData.indexOfFirstTrade + index)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="inline-flex items-center px-3 py-1.5 text-xs bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 text-blue-700 border border-blue-200 rounded-lg transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5"
                              onClick={() => onViewDetails(paginationData.indexOfFirstTrade + index)}
                            >
                              👁️ Details
                            </button>
                            <button
                              className="inline-flex items-center px-3 py-1.5 text-xs bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 text-red-700 border border-red-200 rounded-lg transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5"
                              onClick={() => setShowDeleteIndex(paginationData.indexOfFirstTrade + index)}
                              disabled={isDeleting}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                          {showDeleteIndex === paginationData.indexOfFirstTrade + index && (
                            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <span className="text-sm text-red-700 font-medium block mb-2">
                                Delete {trade.symbol} trade?
                              </span>
                              <div className="flex gap-2">
                                <button
                                  className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white border border-red-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                                  onClick={() => {
                                    console.log(`UI: Confirming delete for trade index ${paginationData.indexOfFirstTrade + index}`);
                                    onDelete(paginationData.indexOfFirstTrade + index);
                                    setShowDeleteIndex(null);
                                  }}
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? (
                                    <>
                                      <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Deleting...
                                    </>
                                  ) : (
                                    '✓ Yes, Delete'
                                  )}
                                </button>
                                <button
                                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-md disabled:opacity-50 transition-colors"
                                  onClick={() => setShowDeleteIndex(null)}
                                  disabled={isDeleting}
                                >
                                  ✗ Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Pagination */}
          {trades.length > tradesPerPage && (
            <Pagination
              currentPage={currentPage}
              totalPages={paginationData.totalPages}
              onPageChange={paginate}
            />
          )}
        </div>
      )}
    </div>
  );
} 