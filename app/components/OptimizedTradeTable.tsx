'use client';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import Pagination from './Pagination';
import { Trade } from '../types/Trade';
import { getLotSize as getSymbolLotSize, parseNSEOptionsSymbol, isOptionsSymbol } from '../lib/symbolParser';

// Memoized helper functions
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

const formatQuantityAsLots = (quantity: number, symbol: string): string => {
  const lotSize = getLotSize(symbol);
  if (lotSize <= 1) return quantity.toString();
  
  const lots = Math.round((quantity / lotSize) * 100) / 100;
  return `${quantity} (${lots} lots)`;
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Ensure entryDate displays the exact stored clock time even if the ISO string is UTC
const adjustDatePreservingClockTime = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const originalInputWasUTC = typeof value === 'string' && value.endsWith('Z');
  const dateObj = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(dateObj.getTime())) return null;
  return originalInputWasUTC ? new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000) : dateObj;
};

const formatEntryDate = (value: string | Date | null | undefined) => {
  const adjusted = adjustDatePreservingClockTime(value);
  if (!adjusted) return 'Invalid date';
  return adjusted.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatEntryTime = (value: string | Date | null | undefined) => {
  const adjusted = adjustDatePreservingClockTime(value);
  if (!adjusted) return '--';
  return adjusted.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

// Memoized trade type icon
const TradeTypeIcon = memo(({ type }: { type: 'LONG' | 'SHORT' }) => 
  type === 'LONG' ? (
    <svg className="h-5 w-5 text-green-500 inline-block mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  ) : (
    <svg className="h-5 w-5 text-red-500 inline-block mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  )
);

// Memoized trade row component
const TradeRow = memo(({ trade, globalIndex, visibleColumns, onEdit, onDelete, onViewDetails, showDeleteIndex, setShowDeleteIndex, isDeleting }: {
  trade: Trade;
  globalIndex: number;
  visibleColumns: { [key: string]: boolean };
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onViewDetails: (index: number) => void;
  showDeleteIndex: number | null;
  setShowDeleteIndex: (index: number | null) => void;
  isDeleting: boolean;
}) => {
  const handleEdit = useCallback(() => onEdit(globalIndex), [onEdit, globalIndex]);
  const handleDelete = useCallback(() => onDelete(globalIndex), [onDelete, globalIndex]);
  const handleViewDetails = useCallback(() => onViewDetails(globalIndex), [onViewDetails, globalIndex]);
  const handleShowDelete = useCallback(() => setShowDeleteIndex(globalIndex), [setShowDeleteIndex, globalIndex]);
  const handleCancelDelete = useCallback(() => setShowDeleteIndex(null), [setShowDeleteIndex]);

  const isProfit = trade.profitLoss && trade.profitLoss > 0;
  const isLoss = trade.profitLoss && trade.profitLoss < 0;

  return (
    <tr className={`transition-all duration-200 hover:bg-gradient-to-r hover:shadow-md ${
      isProfit 
        ? 'hover:from-green-50 hover:to-emerald-50 hover:border-l-4 hover:border-green-400' 
        : isLoss 
          ? 'hover:from-red-50 hover:to-pink-50 hover:border-l-4 hover:border-red-400'
          : 'hover:from-blue-50 hover:to-indigo-50 hover:border-l-4 hover:border-blue-400'
    }`}>
      {visibleColumns.entryDate && (
        <td className="px-6 py-4 whitespace-nowrap text-sm">
          <div className="flex flex-col">
            <span className="text-gray-900 font-semibold">
              {formatEntryDate(trade.entryDate)}
            </span>
            <span className="text-xs text-gray-500">
              {formatEntryTime(trade.entryDate)}
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
            <TradeTypeIcon type={trade.type} />
            <span className="ml-1">{trade.type}</span>
          </div>
        </td>
      )}
      {visibleColumns.strategy && (
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
          {trade.strategy || '-'}
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
              onClick={handleEdit}
            >
              ✏️ Edit
            </button>
            <button
              className="inline-flex items-center px-3 py-1.5 text-xs bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 text-blue-700 border border-blue-200 rounded-lg transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5"
              onClick={handleViewDetails}
            >
              👁️ Details
            </button>
            <button
              className="inline-flex items-center px-3 py-1.5 text-xs bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 text-red-700 border border-red-200 rounded-lg transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5"
              onClick={handleShowDelete}
              disabled={isDeleting}
            >
              🗑️ Delete
            </button>
          </div>
          {showDeleteIndex === globalIndex && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-sm text-red-700 font-medium block mb-2">
                Delete {trade.symbol} trade?
              </span>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white border border-red-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : '✓ Yes, Delete'}
                </button>
                <button
                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-md disabled:opacity-50 transition-colors"
                  onClick={handleCancelDelete}
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
});

// Column selector component
const ColumnSelector = memo(({ visibleColumns, toggleColumn, resetColumns, onClose }: {
  visibleColumns: { [key: string]: boolean };
  toggleColumn: (column: string) => void;
  resetColumns: () => void;
  onClose: () => void;
}) => {
  return (
    <div className="absolute mt-2 ml-0 z-10 bg-white shadow-lg rounded-md border border-gray-200 p-3 w-64">
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
        {Object.entries(visibleColumns).map(([column, visible]) => (
          <label key={column} className="flex items-center text-sm">
            <input 
              type="checkbox" 
              checked={visible} 
              onChange={() => toggleColumn(column)}
              className="mr-2 h-4 w-4 text-indigo-600"
            />
            {column.charAt(0).toUpperCase() + column.slice(1).replace(/([A-Z])/g, ' $1')}
          </label>
        ))}
      </div>
    </div>
  );
});

interface OptimizedTradeTableProps {
  trades: Trade[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onViewDetails: (index: number) => void;
  isDeleting?: boolean;
}

export default function OptimizedTradeTable({ trades, onEdit, onDelete, onViewDetails, isDeleting = false }: OptimizedTradeTableProps) {
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
  
  const columnSelectorRef = useRef<HTMLDivElement>(null);
  
  // Memoized pagination calculations
  const paginationData = useMemo(() => {
    const indexOfLastTrade = currentPage * tradesPerPage;
    const indexOfFirstTrade = indexOfLastTrade - tradesPerPage;
    const currentTrades = trades.slice(indexOfFirstTrade, indexOfLastTrade);
    const totalPages = Math.ceil(trades.length / tradesPerPage);
    
    return { currentTrades, totalPages, indexOfFirstTrade };
  }, [trades, currentPage, tradesPerPage]);

  // Memoized callbacks
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

  const closeColumnSelector = useCallback(() => setShowColumnSelector(false), []);

  // Click outside handler
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

  // Memoized visible column headers
  const visibleColumnHeaders = useMemo(() => {
    const headers: { key: string; label: string }[] = [];
    if (visibleColumns.entryDate) headers.push({ key: 'entryDate', label: 'Entry Date' });
    if (visibleColumns.symbol) headers.push({ key: 'symbol', label: 'Symbol' });
    if (visibleColumns.type) headers.push({ key: 'type', label: 'Type' });
    if (visibleColumns.strategy) headers.push({ key: 'strategy', label: 'Strategy' });
    if (visibleColumns.entryPrice) headers.push({ key: 'entryPrice', label: 'Entry Price' });
    if (visibleColumns.exitPrice) headers.push({ key: 'exitPrice', label: 'Exit Price' });
    if (visibleColumns.quantity) headers.push({ key: 'quantity', label: 'Quantity' });
    if (visibleColumns.strikePrice) headers.push({ key: 'strikePrice', label: 'Strike Price' });
    if (visibleColumns.profitLoss) headers.push({ key: 'profitLoss', label: 'P&L' });
    if (visibleColumns.rating) headers.push({ key: 'rating', label: 'Rating' });
    if (visibleColumns.actions) headers.push({ key: 'actions', label: 'Actions' });
    return headers;
  }, [visibleColumns]);

  if (trades.length === 0) {
    return (
      <div className="bg-white shadow rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Trades</h2>
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">📊</div>
          <p>No trades found. Add your first trade to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent Trades</h2>
        
        <div className="flex items-center space-x-2">
          <div className="relative" ref={columnSelectorRef}>
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
              <ColumnSelector
                visibleColumns={visibleColumns}
                toggleColumn={toggleColumn}
                resetColumns={resetColumns}
                onClose={closeColumnSelector}
              />
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {visibleColumnHeaders.map(header => (
                <th
                  key={header.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginationData.currentTrades.map((trade, index) => (
              <TradeRow
                key={trade.id || index}
                trade={trade}
                globalIndex={paginationData.indexOfFirstTrade + index}
                visibleColumns={visibleColumns}
                onEdit={onEdit}
                onDelete={onDelete}
                onViewDetails={onViewDetails}
                showDeleteIndex={showDeleteIndex}
                setShowDeleteIndex={setShowDeleteIndex}
                isDeleting={isDeleting}
              />
            ))}
          </tbody>
        </table>
      </div>

      {paginationData.totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={paginationData.totalPages}
            onPageChange={paginate}
          />
        </div>
      )}
    </div>
  );
} 