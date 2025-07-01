'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { TradeFormData } from '../actions/trade';
import { 
  parseNSEOptionsSymbol, 
  parseNSEOptionsSymbolWithCorrection,
  formatOptionsSymbol, 
  detectInstrumentType,
  getLotSize,
  isOptionsSymbol,
  isFuturesSymbol,
  parseFuturesSymbol,
  parseSymbol,
  correctMalformedSymbol
} from '../lib/symbolParser';

interface ParsedTradeData extends TradeFormData {
  parsedSymbol?: {
    underlying: string;
    expiry: Date;
    strike: number;
    optionType: 'CE' | 'PE' | 'CALL' | 'PUT';
    isValid: boolean;
    error?: string;
  };
  parseStatus: 'success' | 'partial' | 'failed';
  parseMessage?: string;
}

interface EnhancedCSVImportProps {
  onImport: (trades: TradeFormData[]) => Promise<void>;
}

export default function EnhancedCSVImport({ onImport }: EnhancedCSVImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<ParsedTradeData[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseStats, setParseStats] = useState<{
    total: number;
    success: number;
    partial: number;
    failed: number;
  }>({ total: 0, success: 0, partial: 0, failed: 0 });

  // Function to reset all state and file input
  const resetImportState = () => {
    setCsvFile(null);
    setCsvPreview([]);
    setImportMessage(null);
    setError(null);
    setParseStats({ total: 0, success: 0, partial: 0, failed: 0 });
    setShowImportModal(false);
    
    // Reset the file input value using ref
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📊 Enhanced CSV Import file selected');
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset any previous state
    setError(null);
    setImportMessage(null);
    setCsvPreview([]);
    setParseStats({ total: 0, success: 0, partial: 0, failed: 0 });
    
    // File size validation (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      setError('File size exceeds 10MB limit');
      return;
    }
    
    // File type validation
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }
    
    setCsvFile(file);
    
    // Preview the CSV with enhanced parsing
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 10, // Show first 10 rows in preview
      complete: (results) => {
        const parsedData = enhancedParseCSVData(results.data as any[]);
        setCsvPreview(parsedData.slice(0, 10)); // Preview first 10
        
        // Calculate stats for all data
        const stats = { total: 0, success: 0, partial: 0, failed: 0 };
        parsedData.forEach(trade => {
          stats.total++;
          stats[trade.parseStatus]++;
        });
        setParseStats(stats);
        
        setShowImportModal(true);
      },
      error: (error) => {
        console.error("Preview parse error:", error);
        setError('Failed to parse CSV file. Please check the format.');
      },
    });
  };

  const enhancedParseCSVData = (rawData: any[]): ParsedTradeData[] => {
    console.log('🚀 ENHANCED CSV IMPORT STARTED');
    console.log('Raw data rows:', rawData.length);
    
    // First, parse all individual transactions
    const transactions = rawData.map((row, index) => {
      try {
        // Normalize field names
        const normalizedRow: any = {};
        Object.keys(row).forEach(key => {
          const normalizedKey = key.trim().toLowerCase();
          normalizedRow[normalizedKey] = row[key];
        });

        // Extract symbol (try multiple field names)
        const symbol = normalizedRow.symbol || 
                      normalizedRow.instrument || 
                      normalizedRow.tradingsymbol ||
                      normalizedRow['trading symbol'] ||
                      '';

        if (!symbol) {
          return { ...normalizedRow, symbol: '', index, isValid: false, error: 'No symbol found' };
        }

        const quantity = extractQuantity(normalizedRow);
        const date = extractDate(normalizedRow, 'entry');
        const time = extractTime(normalizedRow);
        console.log(`Parsing row ${index + 1}: Symbol=${symbol}, Type=${extractTradeType(normalizedRow)}, Quantity=${quantity}, Date=${date}, Time=${time}, Raw Time=${normalizedRow.time}`);
        
        return {
          ...normalizedRow,
          symbol: symbol.toUpperCase(),
          index,
          isValid: true,
          transactionType: extractTradeType(normalizedRow),
          price: extractPrice(normalizedRow, 'entry') || 0,
          quantity: quantity,
          date: extractDate(normalizedRow, 'entry') || new Date().toISOString().split('T')[0],
          time: normalizedRow.time || ''
        };

      } catch (error) {
        return { ...row, index, isValid: false, error: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    });

    // Group transactions by symbol and date
    const groupedTransactions = new Map<string, any[]>();
    
    transactions.forEach(transaction => {
      if (!transaction.isValid) return;
      
      const dateOnly = transaction.date.split('T')[0]; // Extract just the date part
      const key = `${transaction.symbol}_${dateOnly}`;
      console.log(`Grouping transaction: Key=${key}, Symbol=${transaction.symbol}, Date=${transaction.date}, DateOnly=${dateOnly}`);
      
      if (!groupedTransactions.has(key)) {
        groupedTransactions.set(key, []);
      }
      groupedTransactions.get(key)!.push(transaction);
    });
    
    console.log(`Total groups created: ${groupedTransactions.size}`);
    groupedTransactions.forEach((transactions, key) => {
      console.log(`Group ${key}: ${transactions.length} transactions`);
    });

    // Convert grouped transactions into trades
    const groupedTrades: ParsedTradeData[] = [];
    
    groupedTransactions.forEach((transactions, key) => {
      try {
        // Sort transactions by time to get proper entry/exit order
        transactions.sort((a, b) => {
          if (a.time && b.time) {
            return a.time.localeCompare(b.time);
          }
          return 0;
        });

        const symbol = transactions[0].symbol;
        const parsedSymbol = parseNSEOptionsSymbolWithCorrection(symbol);
        const instrumentType = detectInstrumentType(symbol);

        // Separate BUY and SELL transactions
        const buyTransactions = transactions.filter(t => t.transactionType === 'LONG');
        const sellTransactions = transactions.filter(t => t.transactionType === 'SHORT');

        // Calculate entry and exit details
        let entryPrice = 0;
        let entryQuantity = 0;
        let exitPrice: number | undefined;
        let exitQuantity = 0;
        let exitDate: string | undefined;

        // Calculate weighted average entry price
        if (buyTransactions.length > 0) {
          let totalValue = 0;
          buyTransactions.forEach(t => {
            totalValue += t.price * t.quantity;
            entryQuantity += t.quantity;
          });
          entryPrice = totalValue / entryQuantity;
        }

        // Calculate weighted average exit price
        if (sellTransactions.length > 0) {
          let totalValue = 0;
          sellTransactions.forEach(t => {
            totalValue += t.price * t.quantity;
            exitQuantity += t.quantity;
          });
          exitPrice = totalValue / exitQuantity;
          exitDate = sellTransactions[0].date;
        }

        // Handle case where there are only SELL transactions (short trades)
        if (buyTransactions.length === 0 && sellTransactions.length > 0) {
          // For pure short trades, the first sell is the entry
          entryPrice = exitPrice || 0;
          entryQuantity = exitQuantity;
          exitPrice = undefined;
          exitDate = undefined;
        }

        // Determine trade type based on net position
        const netQuantity = entryQuantity - exitQuantity;
        const tradeType: 'LONG' | 'SHORT' = netQuantity > 0 ? 'LONG' : (netQuantity < 0 ? 'SHORT' : 'LONG');

        // Calculate P&L if both entry and exit exist
        let profitLoss: number | undefined;
        if (exitPrice && entryPrice) {
          const completedQuantity = Math.min(entryQuantity, exitQuantity);
          profitLoss = (exitPrice - entryPrice) * completedQuantity;
        }

        // Extract time from the first (earliest) transaction
        const entryTime = extractTime(transactions[0]);
        
        // Calculate lot information for notes
        const lotSize = parsedSymbol.isValid ? getLotSize(parsedSymbol.underlying) : 0;
        const lots = lotSize > 0 ? Math.max(entryQuantity, exitQuantity) / lotSize : 0;
        const lotInfo = lotSize > 0 && lots > 0 ? ` (${lots} lots)` : '';

        const tradeData: ParsedTradeData = {
          symbol: parsedSymbol.isValid ? parsedSymbol.underlying : symbol,
          type: tradeType,
          instrumentType,
          entryPrice,
          exitPrice,
          quantity: Math.max(entryQuantity, exitQuantity), // Use the larger quantity as the trade size
          entryDate: transactions[0].date,
          exitDate,
          profitLoss,
          notes: `${entryTime}${lotInfo} - Grouped from ${transactions.length} transactions`,
          parseStatus: 'success',
          parsedSymbol: undefined
        };

        // Add options-specific data
        if (parsedSymbol.isValid && instrumentType === 'OPTIONS') {
          tradeData.parsedSymbol = parsedSymbol;
          tradeData.strikePrice = parsedSymbol.strike;
          tradeData.expiryDate = parsedSymbol.expiry.toISOString().split('T')[0];
          tradeData.optionType = parsedSymbol.optionType === 'CE' ? 'CALL' : 'PUT';
          tradeData.parseMessage = `✅ ${formatOptionsSymbol(parsedSymbol)} (${transactions.length} transactions)`;
        } else if (isOptionsSymbol(symbol) && !parsedSymbol.isValid) {
          tradeData.parseStatus = 'failed';
          tradeData.parseMessage = `❌ ${parsedSymbol.error}`;
        } else {
          tradeData.parseMessage = `✅ ${instrumentType} - ${symbol} (${transactions.length} transactions)`;
        }

        groupedTrades.push(tradeData);

      } catch (error) {
        // If grouping fails, create a failed trade
        groupedTrades.push(createFailedTrade(transactions[0], transactions[0].index, `Grouping error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });

    console.log('✅ ENHANCED CSV IMPORT COMPLETED');
    console.log('Final grouped trades:', groupedTrades.length);
    
    return groupedTrades;
  };

  const createFailedTrade = (row: any, index: number, message: string): ParsedTradeData => ({
    symbol: `ROW_${index + 1}`,
    type: 'LONG',
    instrumentType: 'STOCK',
    entryPrice: 0,
    quantity: 0,
    entryDate: new Date().toISOString().split('T')[0],
    parseStatus: 'failed',
    parseMessage: `❌ ${message}`
  });

  const extractTradeType = (row: any): 'LONG' | 'SHORT' => {
    const type = (row.type || row.side || row.direction || '').toString().toLowerCase();
    if (type.includes('sell') || type.includes('short')) return 'SHORT';
    return 'LONG';
  };

  const extractPrice = (row: any, priceType: 'entry' | 'exit'): number | undefined => {
    const fields = priceType === 'entry' 
      ? ['entryprice', 'entry price', 'avg price', 'avg. price', 'price', 'rate']
      : ['exitprice', 'exit price', 'sell price', 'close price'];
    
    for (const field of fields) {
      const value = row[field];
      if (value !== undefined && value !== null && value !== '') {
        const numValue = parseFloat(value.toString().replace(/[^\d.-]/g, ''));
        if (!isNaN(numValue) && numValue > 0) return numValue;
      }
    }
    return priceType === 'entry' ? 0 : undefined;
  };

  const extractQuantity = (row: any, underlying?: string): number => {
    const qtyFields = ['quantity', 'qty', 'qty.', 'lots'];
    
    for (const field of qtyFields) {
      const value = row[field];
      if (value !== undefined && value !== null && value !== '') {
        const valueStr = value.toString();
        
        // Handle broker format like "70/70" - take the first number
        if (valueStr.includes('/')) {
          const firstPart = valueStr.split('/')[0];
          const numValue = parseFloat(firstPart.replace(/[^\d.-]/g, ''));
          if (!isNaN(numValue) && numValue > 0) {
            // If it's lots, convert to quantity
            if (field === 'lots' && underlying) {
              return numValue * getLotSize(underlying);
            }
            return numValue;
          }
        } else {
          // Normal quantity parsing
          const numValue = parseFloat(valueStr.replace(/[^\d.-]/g, ''));
          if (!isNaN(numValue) && numValue > 0) {
            // If it's lots, convert to quantity
            if (field === 'lots' && underlying) {
              return numValue * getLotSize(underlying);
            }
            return numValue;
          }
        }
      }
    }
    return 0;
  };

  const extractDate = (row: any, dateType: 'entry' | 'exit'): string | undefined => {
    const fields = dateType === 'entry' 
      ? ['entrydate', 'entry date', 'date', 'time', 'trade date']
      : ['exitdate', 'exit date', 'close date', 'sell date'];
    
    for (const field of fields) {
      const value = row[field];
      if (value) {
        try {
          // Handle broker datetime format like "2025-06-16 09:31:30"
          if (typeof value === 'string' && value.includes(' ')) {
            // Return the full datetime string for database storage
            return new Date(value).toISOString();
          }
          
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        } catch (e) {
          // Continue to next field
        }
      }
    }
    return dateType === 'entry' ? new Date().toISOString() : undefined;
  };

  const extractProfitLoss = (row: any): number | undefined => {
    const fields = ['profitloss', 'profit loss', 'profit/loss', 'pnl', 'p&l', 'realized pnl'];
    
    for (const field of fields) {
      const value = row[field];
      if (value !== undefined && value !== null && value !== '') {
        const numValue = parseFloat(value.toString().replace(/[^\d.-]/g, ''));
        if (!isNaN(numValue)) return numValue;
      }
    }
    return undefined;
  };

  const extractTime = (row: any): string => {
    const fields = ['time', 'trade time', 'timestamp', 'datetime'];
    
    for (const field of fields) {
      const value = row[field];
      if (value) {
        try {
          // Handle broker datetime format like "2025-06-16 09:31:30"
          if (typeof value === 'string' && value.includes(' ')) {
            const timePart = value.split(' ')[1]; // Get time part
            if (timePart) {
              // Convert 24h to 12h format
              const [hours, minutes] = timePart.split(':');
              const hour24 = parseInt(hours);
              const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
              const ampm = hour24 >= 12 ? 'pm' : 'am';
              return `${hour12}:${minutes} ${ampm}`;
            }
          }
        } catch (e) {
          // Continue to next field
        }
      }
    }
    return '12:00 am'; // Default fallback
  };

  const extractNotes = (row: any): string => {
    return row.notes || row.comment || row.remarks || '';
  };

  const confirmImport = async () => {
    if (!csvFile) return;
    
    setIsImporting(true);
    setError(null);
    
    try {
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const parsedTrades = enhancedParseCSVData(results.data as any[]);
            
            // Filter out failed trades
            const validTrades = parsedTrades.filter(trade => trade.parseStatus !== 'failed');
            
            if (validTrades.length === 0) {
              setError('No valid trades found in CSV file.');
              setIsImporting(false);
              return;
            }

            setImportMessage(`Importing ${validTrades.length} valid trades...`);
            
            // Convert to TradeFormData (remove parse-specific fields)
            const tradesForImport: TradeFormData[] = validTrades.map(trade => {
              const { parsedSymbol, parseStatus, parseMessage, ...tradeData } = trade;
              return tradeData;
            });
            
            await onImport(tradesForImport);
            
            setImportMessage(`✅ Successfully imported ${validTrades.length} trades!`);
            
            // Use timeout to show success message briefly before resetting
            setTimeout(() => {
              resetImportState();
            }, 1500);
            
          } catch (error) {
            console.error('Import error:', error);
            setError(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          } finally {
            setIsImporting(false);
          }
        },
        error: (error) => {
          setError(`CSV parsing error: ${error.message}`);
          setIsImporting(false);
        }
      });
    } catch (error) {
      setError(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsImporting(false);
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      {
        symbol: 'BANKNIFTY26032678000CE',
        type: 'LONG',
        entryPrice: 150.50,
        exitPrice: 175.25,
        quantity: 35,
        entryDate: '2024-03-20',
        exitDate: '2024-03-21',
        notes: 'Sample options trade'
      },
      {
        symbol: 'NIFTY25060525000PE',
        type: 'SHORT', 
        entryPrice: 85.75,
        exitPrice: 65.50,
        quantity: 75,
        entryDate: '2024-03-18',
        exitDate: '2024-03-19',
        notes: 'Sample put option'
      },
      {
        symbol: 'RELIANCE',
        type: 'LONG',
        entryPrice: 2450.00,
        exitPrice: 2520.00,
        quantity: 100,
        entryDate: '2024-03-15',
        exitDate: '2024-03-16',
        notes: 'Sample stock trade'
      }
    ];

    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_trades.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Import Button */}
      <div className="flex gap-2 mb-4">
        <label className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 cursor-pointer">
          📊 Enhanced CSV Import
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
        </label>
        
        <button
          onClick={downloadSampleCSV}
          className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200"
        >
          📥 Download Sample
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Enhanced CSV Import Preview</h3>
              
              {/* Parse Statistics */}
              <div className="mt-4 grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-600">Total Trades</p>
                  <p className="text-xl font-bold text-blue-900">{parseStats.total}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-600">Successfully Parsed</p>
                  <p className="text-xl font-bold text-green-900">{parseStats.success}</p>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <p className="text-sm text-yellow-600">Partially Parsed</p>
                  <p className="text-xl font-bold text-yellow-900">{parseStats.partial}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-sm text-red-600">Failed to Parse</p>
                  <p className="text-xl font-bold text-red-900">{parseStats.failed}</p>
                </div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="p-6 overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Symbol</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Entry Price</th>
                    <th className="text-left p-2">Quantity</th>
                    <th className="text-left p-2">Parse Status</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.map((trade, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{trade.symbol}</td>
                      <td className="p-2">{trade.type}</td>
                      <td className="p-2">₹{trade.entryPrice}</td>
                      <td className="p-2">{trade.quantity}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          trade.parseStatus === 'success' ? 'bg-green-100 text-green-800' :
                          trade.parseStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {trade.parseMessage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-gray-200 flex gap-4">
              <button
                onClick={confirmImport}
                disabled={isImporting || parseStats.success === 0}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : `Import ${parseStats.success} Valid Trades`}
              </button>
              
              <button
                onClick={resetImportState}
                disabled={isImporting}
                className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-all duration-200"
              >
                Cancel
              </button>
            </div>

            {importMessage && (
              <div className="p-4 bg-blue-50 border-t border-blue-200 text-blue-800">
                {importMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 