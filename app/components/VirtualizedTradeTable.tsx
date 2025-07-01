import { memo, useCallback } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Trade } from '../types/Trade';
import { getLotSize as getSymbolLotSize, parseNSEOptionsSymbol, isOptionsSymbol } from '../lib/symbolParser';

// Helper functions copied (keep sync with TradeTable)
const getLotSize = (symbol: string): number => {
  if (!symbol) return 1;
  if (isOptionsSymbol(symbol)) {
    const parsed = parseNSEOptionsSymbol(symbol);
    if (parsed.isValid) return getSymbolLotSize(parsed.underlying);
  }
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

interface VirtualizedTradeTableProps {
  trades: Trade[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onViewDetails: (index: number) => void;
  isDeleting?: boolean;
}

// Row renderer for react-window (memoized for perf)
const Row = memo(({ data, index, style }: ListChildComponentProps) => {
  const { trades, onEdit, onDelete, onViewDetails, isDeleting } = data;
  const trade: Trade = trades[index];

  const handleEdit = useCallback(() => onEdit(index), [onEdit, index]);
  const handleDelete = useCallback(() => onDelete(index), [onDelete, index]);
  const handleView = useCallback(() => onViewDetails(index), [onViewDetails, index]);

  const isProfit = trade.profitLoss && trade.profitLoss > 0;
  const isLoss = trade.profitLoss && trade.profitLoss < 0;

  return (
    <div
      style={style}
      className={`flex items-center px-4 border-b border-gray-100 text-sm whitespace-nowrap ${
        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
      }`}
    >
      <div className="w-24 flex-shrink-0">
        {new Date(trade.entryDate).toLocaleDateString('en-IN')}
      </div>
      <div className="w-32 flex-shrink-0 font-medium">{trade.symbol}</div>
      <div className="w-20 flex-shrink-0">
        {trade.type === 'LONG' ? '📈 Long' : '📉 Short'}
      </div>
      <div className="w-28 flex-shrink-0 text-gray-700">₹{formatCurrency(trade.entryPrice)}</div>
      <div className="w-28 flex-shrink-0 text-gray-700">
        {trade.exitPrice ? `₹${formatCurrency(trade.exitPrice)}` : '-'}
      </div>
      <div className="w-40 flex-shrink-0 text-gray-700">
        {formatQuantityAsLots(trade.quantity, trade.symbol)}
      </div>
      <div className="w-28 flex-shrink-0 font-semibold">
        {trade.profitLoss ? (
          <span className={isProfit ? 'text-green-600' : isLoss ? 'text-red-600' : ''}>
            ₹{formatCurrency(trade.profitLoss)}
          </span>
        ) : (
          '-'
        )}
      </div>
      <div className="ml-auto flex gap-2">
        <button onClick={handleView} className="text-blue-600 text-xs">View</button>
        <button onClick={handleEdit} className="text-indigo-600 text-xs">Edit</button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-red-600 text-xs disabled:opacity-50"
        >
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
});
Row.displayName = 'Row';

export default function VirtualizedTradeTable({ trades, onEdit, onDelete, onViewDetails, isDeleting }: VirtualizedTradeTableProps) {
  const itemSize = 48; // px height per row

  return (
    <div className="h-[600px] w-full border border-gray-200 rounded-lg overflow-hidden">
      <AutoSizer disableHeight>
        {({ width }) => (
          <List
            height={600}
            width={width}
            itemCount={trades.length}
            itemSize={itemSize}
            itemData={{ trades, onEdit, onDelete, onViewDetails, isDeleting }}
            overscanCount={10}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
} 