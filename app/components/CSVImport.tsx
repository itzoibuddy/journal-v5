'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import DOMPurify from 'dompurify';
import { TradeFormData } from '../actions/trade';
import { getLotSize as getSymbolLotSize, parseNSEOptionsSymbol, isOptionsSymbol } from '../lib/symbolParser';

// Helper function for safe toISOString conversion
function safeToISOString(date: any): string {
  return typeof date === 'object' && date !== null && 'toISOString' in date
    ? date.toISOString()
    : date;
}

// Helper function to convert lots to quantity based on symbol
const convertLotsToQuantity = (lots: number, symbol: string): number => {
  return lots * getSymbolLotSize(symbol);
};

// Helper function to calculate lot size for a symbol
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

interface CSVImportProps {
  onImport: (trades: TradeFormData[]) => Promise<void>;
}

export default function CSVImport({ onImport }: CSVImportProps) {
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
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
    
    // Preview the CSV
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 5, // Show only first 5 rows in preview
      complete: (results) => {
        setCsvPreview(results.data as any[]);
        setShowImportModal(true);
      },
      error: (error) => {
        console.error("Preview parse error:", error);
        setError('Failed to parse CSV file. Please check the format.');
      },
    });
  };
  
  const confirmImport = async () => {
    if (!csvFile) return;
    
    setIsImporting(true);
    setError(null); // Clear any previous errors
    
    try {
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => {
          // Normalize header names by trimming whitespace and converting to lowercase
          return header.trim().toLowerCase();
        },
        complete: async (results) => {
          try {
            if (results.errors && results.errors.length > 0) {
              console.error("CSV parsing errors:", results.errors);
              setError(`CSV parsing error: ${results.errors[0]?.message || 'Unknown parsing error'}`);
              setIsImporting(false);
              return;
            }
            
            if (!results.data || results.data.length === 0) {
              setError('No data found in CSV file.');
              setIsImporting(false);
              return;
            }
            
            setImportMessage('Importing trades...');
            const imported: TradeFormData[] = [];
            
            // Process broker format CSV
            for (const row of results.data as any[]) {
              // Check if this is broker format (has Time, Type, Instrument, Product, Qty., Avg. price, Status)
              const isBrokerFormat = (row.time !== undefined || row.Time !== undefined) && 
                                    (row.type !== undefined || row.Type !== undefined) && 
                                    (row.instrument !== undefined || row.Instrument !== undefined) && 
                                    (row.qty !== undefined || row['qty.'] !== undefined || row.Qty !== undefined || row['Qty.'] !== undefined) && 
                                    (row['avg. price'] !== undefined || row['Avg. price'] !== undefined);
              
              if (isBrokerFormat) {
                // Get field values with fallbacks for different case variations
                const instrumentValue = row.instrument || row.Instrument || '';
                const typeValue = row.type || row.Type || '';
                const qtyValue = row.qty || row['qty.'] || row.Qty || row['Qty.'] || '';
                const timeValue = row.time || row.Time || '';
                const priceValue = row['avg. price'] || row['Avg. price'] || 0;
                
                // Extract data from broker format
                // Try to match the full pattern like NIFTY2561224900PE or SENSEX2561081500CE
                const instrumentParts = instrumentValue.match(/([A-Z]+)(\d{5})(\d{4,6})([CP]E)/i);
                let symbol = instrumentValue.includes('NIFTY') ? 'NIFTY' : 
                             instrumentValue.includes('SENSEX') ? 'SENSEX' : 'NIFTY';
                let strikePrice = 0; // Default to 0, will be updated if we can extract it
                let optionType: 'CALL' | 'PUT' | null = null;
                let expiryDate: string | null = null;
                
                if (instrumentParts && instrumentParts.length >= 5) {
                  symbol = instrumentParts[1]; // NIFTY or SENSEX
                  // The strike price is the third capture group (index 3)
                  const extractedStrikePrice = parseFloat(instrumentParts[3]); // Strike price
                  strikePrice = isNaN(extractedStrikePrice) || extractedStrikePrice <= 0 ? 
                                symbol === 'SENSEX' ? 81500 : 24900 : extractedStrikePrice; // Ensure positive value with appropriate defaults
                  optionType = instrumentParts[4] === 'CE' || instrumentParts[4] === 'ce' ? 'CALL' : 'PUT';
                  
                  // Try to extract expiry date from the second group (e.g., 25612 means 2025-06-12)
                  const dateCode = instrumentParts[2];
                  if (dateCode && dateCode.length >= 5) {
                    try {
                      const year = parseInt('20' + dateCode.substring(0, 2));
                      const month = parseInt(dateCode.substring(2, 4)) - 1; // JS months are 0-indexed
                      const day = parseInt(dateCode.substring(4));
                      expiryDate = new Date(year, month, day).toISOString().split('T')[0];
                    } catch (e) {
                      console.warn("Could not parse expiry date from", dateCode);
                    }
                  }
                } else {
                  // Try a pattern for formats like NIFTY24900PE or SENSEX81500CE
                  const directMatch = instrumentValue.match(/([A-Z]+)(\d{4,6})([CP]E)/i);
                  if (directMatch && directMatch.length >= 3) {
                    symbol = directMatch[1];
                    strikePrice = parseFloat(directMatch[2]);
                    optionType = directMatch[3].toUpperCase() === 'CE' ? 'CALL' : 'PUT';
                  } else {
                    // Try a more specific pattern for NIFTY2561224800PE or SENSEX2561081500CE format
                    // This extracts the last 4-6 digits before CE/PE as strike price
                    const specificMatch = instrumentValue.match(/([A-Z]+)(\d+)(\d{4,6})([CP]E)/i);
                    if (specificMatch && specificMatch.length >= 5) {
                      symbol = specificMatch[1];
                      strikePrice = parseFloat(specificMatch[3]);
                      optionType = specificMatch[4].toUpperCase() === 'CE' ? 'CALL' : 'PUT';
                      
                      // Try to extract expiry date from the second group
                      const dateCode = specificMatch[2];
                      if (dateCode && dateCode.length >= 5) {
                        try {
                          const year = parseInt('20' + dateCode.substring(0, 2));
                          const month = parseInt(dateCode.substring(2, 4)) - 1; // JS months are 0-indexed
                          const day = parseInt(dateCode.substring(4));
                          expiryDate = new Date(year, month, day).toISOString().split('T')[0];
                        } catch (e) {
                          console.warn("Could not parse expiry date from", dateCode);
                        }
                      }
                    } else {
                      // Try a simpler pattern to extract just the strike price
                      const simpleMatch = instrumentValue.match(/(\d{4,6})([CP]E)/i);
                      if (simpleMatch && simpleMatch.length >= 2) {
                        strikePrice = parseFloat(simpleMatch[1]);
                        optionType = simpleMatch[2].toUpperCase() === 'CE' ? 'CALL' : 'PUT';
                      } else {
                        // Try an even more general pattern
                        const generalMatch = instrumentValue.match(/(\d{4,6})/);
                        if (generalMatch && generalMatch.length >= 1) {
                          strikePrice = parseFloat(generalMatch[1]);
                          // Try to determine option type from the instrument string
                          optionType = instrumentValue.toUpperCase().includes('CE') ? 'CALL' : 
                                      instrumentValue.toUpperCase().includes('PE') ? 'PUT' : null;
                        } else {
                          // If we can't extract from the instrument name, set the default strike price based on symbol
                          strikePrice = symbol === 'SENSEX' ? 81500 : 24900;
                        }
                      }
                    }
                  }
                }
                
                // Convert BUY/SELL to LONG/SHORT
                const tradeType = typeValue.toUpperCase() === 'BUY' ? 'LONG' : 'SHORT';
                
                // Extract quantity (remove "/75" format if present)
                const quantityMatch = qtyValue.toString().match(/(\d+)/);
                let quantity = quantityMatch ? parseFloat(quantityMatch[1]) : 0;
                
                // Handle lot sizes - if the quantity is in lots, convert to actual quantity
                // NIFTY 1 lot = 75 qty, SENSEX 1 lot = 20 qty
                if (quantity <= 10) { // Likely lot size rather than actual quantity
                  quantity = convertLotsToQuantity(quantity, symbol);
                }
                
                // Parse date from broker format
                const dateTimeParts = timeValue.split(' ');
                let entryDate = dateTimeParts.length === 2 ? timeValue.replace(' ', 'T') : timeValue;
                
                // Ensure the date is in ISO format
                try {
                  const parsedDate = new Date(entryDate);
                  if (isNaN(parsedDate.getTime())) {
                    // If date parsing fails, use current date
                    entryDate = new Date().toISOString();
                  } else {
                    entryDate = parsedDate.toISOString();
                  }
                } catch (e) {
                  entryDate = new Date().toISOString();
                }
                
                // Determine instrument type from the instrument name
                let instrumentType: 'STOCK' | 'FUTURES' | 'OPTIONS' = 'STOCK';
                if (instrumentValue.includes('PE') || instrumentValue.includes('CE')) {
                  instrumentType = 'OPTIONS';
                } else if (instrumentValue.includes('FUT')) {
                  instrumentType = 'FUTURES';
                }
                
                // Ensure optionType is either 'CALL', 'PUT', or null
                const finalOptionType: 'CALL' | 'PUT' | null = 
                  optionType === 'CALL' ? 'CALL' : 
                  optionType === 'PUT' ? 'PUT' : null;
                
                // Parse price
                const price = parseFloat(priceValue.toString());
                
                // Validate and sanitize the data
                const validatedPrice = isNaN(price) || price <= 0 ? 1 : price;
                const validatedQuantity = isNaN(quantity) || quantity <= 0 ? 1 : quantity;
                const validatedStrikePrice = isNaN(strikePrice) || strikePrice <= 0 ? null : strikePrice;
                
                // Calculate lots for display in notes
                const lotSize = getLotSize(symbol);
                const lots = lotSize > 1 ? Math.round(quantity / lotSize * 100) / 100 : quantity;
                
                // Sanitize string inputs
                const sanitizedNotes = DOMPurify.sanitize(`${instrumentValue} ${typeValue} @ ${validatedPrice} (Strike: ${validatedStrikePrice || 'N/A'}, Qty: ${validatedQuantity} = ${lots} lots)`);
                
                imported.push({
                  symbol: DOMPurify.sanitize(symbol || 'UNKNOWN'),
                  type: tradeType,
                  instrumentType,
                  entryPrice: validatedPrice,
                  exitPrice: null,
                  quantity: validatedQuantity,
                  strikePrice: validatedStrikePrice,
                  expiryDate: expiryDate,
                  optionType: finalOptionType,
                  entryDate,
                  exitDate: null,
                  profitLoss: null,
                  notes: sanitizedNotes,
                  sector: 'Index',
                  strategy: null,
                  setupImageUrl: null,
                  preTradeEmotion: null,
                  postTradeEmotion: null,
                  tradeConfidence: null,
                  tradeRating: null,
                  lessons: null,
                  riskRewardRatio: null,
                  stopLoss: null,
                  targetPrice: null,
                  timeFrame: null,
                  marketCondition: null,
                  premium: null,
                });
              } else {
                // Original app format handling
                const symbol = row.symbol || '';
                const type = row.type || '';
                const entryPrice = row.entryprice || row['entry price'] || row.entryPrice || '';
                const quantity = row.quantity || row.qty || '';
                const entryDate = row.entrydate || row['entry date'] || row.entryDate || '';
                
                if (!symbol || !type || !entryPrice || !quantity || !entryDate) {
                  console.warn("Skipping row due to missing required fields:", row);
                  continue;
                }
                
                // Calculate profit/loss if not provided but exit price is available
                let profitLoss = row.profitloss || row['profit/loss'] || row.profitLoss ? parseFloat(row.profitloss || row['profit/loss'] || row.profitLoss) : null;
                const exitPrice = row.exitprice || row['exit price'] || row.exitPrice ? parseFloat(row.exitprice || row['exit price'] || row.exitPrice) : null;
                
                if (!profitLoss && exitPrice) {
                  const parsedEntryPrice = parseFloat(entryPrice);
                  const parsedQuantity = parseFloat(quantity);
                  const parsedType = type.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG';
                  
                  if (parsedType === 'LONG') {
                    profitLoss = (exitPrice - parsedEntryPrice) * parsedQuantity;
                  } else {
                    profitLoss = (parsedEntryPrice - exitPrice) * parsedQuantity;
                  }
                }
                
                // Get other fields with fallbacks
                const instrumentType = (row.instrumenttype || row['instrument type'] || row.instrumentType || 'STOCK').toUpperCase();
                const strikePrice = row.strikeprice || row['strike price'] || row.strikePrice ? parseFloat(row.strikeprice || row['strike price'] || row.strikePrice) : null;
                const optionType = row.optiontype || row['option type'] || row.optionType ? (row.optiontype || row['option type'] || row.optionType).toUpperCase() : null;
                const exitDate = row.exitdate || row['exit date'] || row.exitDate || null;
                const notes = row.notes || '';
                const sector = row.sector || '';
                const expiryDate = row.expirydate || row['expiry date'] || row.expiryDate || null;
                
                // Ensure proper date formatting for original format
                let formattedEntryDate = entryDate;
                let formattedExitDate = exitDate;
                
                try {
                  const entryDateObj = new Date(entryDate);
                  if (isNaN(entryDateObj.getTime())) {
                    formattedEntryDate = new Date().toISOString();
                  } else {
                    formattedEntryDate = entryDateObj.toISOString();
                  }
                } catch (e) {
                  formattedEntryDate = new Date().toISOString();
                }
                
                if (exitDate) {
                  try {
                    const exitDateObj = new Date(exitDate);
                    if (isNaN(exitDateObj.getTime())) {
                      formattedExitDate = null;
                    } else {
                      formattedExitDate = exitDateObj.toISOString();
                    }
                  } catch (e) {
                    formattedExitDate = null;
                  }
                } else {
                  formattedExitDate = null;
                }
                
                // Ensure proper expiry date formatting
                let formattedExpiryDate = expiryDate;
                if (expiryDate) {
                  try {
                    const expiryDateObj = new Date(expiryDate);
                    if (isNaN(expiryDateObj.getTime())) {
                      formattedExpiryDate = null;
                    } else {
                      formattedExpiryDate = expiryDateObj.toISOString().split('T')[0]; // Date only
                    }
                  } catch (e) {
                    formattedExpiryDate = null;
                  }
                }
                
                // Validate and sanitize the data for original format
                const validatedEntryPrice = parseFloat(entryPrice);
                const validatedQuantity = parseFloat(quantity);
                const validatedStrikePrice = strikePrice && parseFloat(strikePrice.toString()) > 0 ? parseFloat(strikePrice.toString()) : null;
                
                // Ensure valid numeric values
                if (isNaN(validatedEntryPrice) || validatedEntryPrice <= 0) {
                  console.warn(`Invalid entry price for ${symbol}, skipping trade`);
                  continue;
                }
                if (isNaN(validatedQuantity) || validatedQuantity <= 0) {
                  console.warn(`Invalid quantity for ${symbol}, skipping trade`);
                  continue;
                }
                
                imported.push({
                  symbol: symbol || 'UNKNOWN',
                  type: type.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG',
                  instrumentType: instrumentType === 'OPTIONS' ? 'OPTIONS' : instrumentType === 'FUTURES' ? 'FUTURES' : 'STOCK',
                  entryPrice: validatedEntryPrice,
                  exitPrice,
                  quantity: validatedQuantity,
                  strikePrice: validatedStrikePrice,
                  expiryDate: formattedExpiryDate,
                  optionType: optionType === 'PUT' ? 'PUT' : optionType === 'CALL' ? 'CALL' : null,
                  entryDate: formattedEntryDate,
                  exitDate: formattedExitDate,
                  profitLoss,
                  notes: notes || '',
                  sector: sector || '',
                  strategy: null,
                  setupImageUrl: null,
                  preTradeEmotion: null,
                  postTradeEmotion: null,
                  tradeConfidence: null,
                  tradeRating: null,
                  lessons: null,
                  riskRewardRatio: null,
                  stopLoss: null,
                  targetPrice: null,
                  timeFrame: null,
                  marketCondition: null,
                  premium: null,
                });
              }
            }
            
            console.log("Trades to import:", imported);
            
            if (imported.length === 0) {
              setError('No valid trades found in the CSV file. Please check the format.');
              setIsImporting(false);
              return;
            }
            
            // Process related trades to calculate P/L
            const processedTrades = processRelatedTrades(imported);
            console.log("Processed trades with P/L:", processedTrades);
            
            // Import the trades
            try {
              console.log("About to import trades:", processedTrades);
              await onImport(processedTrades);
              
              setImportMessage(`Successfully imported ${processedTrades.length} trades!`);
              setTimeout(() => setImportMessage(null), 4000);
              setShowImportModal(false);
              setCsvFile(null);
              setCsvPreview([]);
              setIsImporting(false);
            } catch (importError) {
              console.error("Error during trade import:", importError);
              throw new Error(`Import failed: ${importError instanceof Error ? importError.message : 'Unknown import error'}`);
            }
          } catch (err) {
            console.error("Error in CSV import process:", err);
            setError(`Failed to import trades: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setIsImporting(false);
          }
        },
        error: (err) => {
          console.error("Papa parse error:", err);
          setError(`Failed to parse CSV: ${err.message}`);
          setIsImporting(false);
        },
      });
    } catch (err) {
      console.error("Top level error in confirmImport:", err);
      setError(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsImporting(false);
    }
  };
  
  const downloadSampleCSV = () => {
    const sampleData = [
      {
        symbol: 'RELIANCE',
        type: 'LONG',
        instrumentType: 'STOCK',
        entryPrice: '2850',
        exitPrice: '2950',
        quantity: '10',
        entryDate: '2025-06-01T10:00:00',
        exitDate: '2025-06-01T14:30:00',
        profitLoss: '1000',
        notes: 'Earnings momentum trade',
        sector: 'Energy'
      },
      {
        symbol: 'HDFCBANK',
        type: 'SHORT',
        instrumentType: 'STOCK',
        entryPrice: '1650',
        exitPrice: '1600',
        quantity: '20',
        entryDate: '2025-06-02T09:30:00',
        exitDate: '2025-06-02T15:45:00',
        profitLoss: '1000',
        notes: 'Technical breakdown',
        sector: 'Banking'
      },
      {
        symbol: 'NIFTY',
        type: 'LONG',
        instrumentType: 'FUTURES',
        entryPrice: '23400',
        exitPrice: '23650',
        quantity: '1',
        entryDate: '2025-06-03T09:30:00',
        exitDate: '2025-06-03T15:15:00',
        expiryDate: '2025-06-26',
        profitLoss: '250',
        notes: 'Trend following trade',
        sector: 'Index'
      },
      {
        symbol: 'RELIANCE',
        type: 'LONG',
        instrumentType: 'OPTIONS',
        entryPrice: '45',
        exitPrice: '85',
        quantity: '25',
        strikePrice: '3000',
        optionType: 'CALL',
        entryDate: '2025-06-04T10:15:00',
        exitDate: '2025-06-04T14:30:00',
        expiryDate: '2025-06-26',
        profitLoss: '1000',
        notes: 'Earnings play',
        sector: 'Energy'
      }
    ];
    
    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_trades.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add this function to process related trades and calculate P/L
  const processRelatedTrades = (trades: TradeFormData[]): TradeFormData[] => {
    // Sort trades by date (oldest first)
    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = new Date(a.entryDate);
      const dateB = new Date(b.entryDate);
      return dateA.getTime() - dateB.getTime();
    });

    // Group trades by instrument (symbol + strike price + option type)
    const tradeGroups: { [key: string]: TradeFormData[] } = {};
    
    for (const trade of sortedTrades) {
      const instrumentKey = `${trade.symbol}_${trade.strikePrice}_${trade.optionType}`;
      if (!tradeGroups[instrumentKey]) {
        tradeGroups[instrumentKey] = [];
      }
      tradeGroups[instrumentKey].push(trade);
    }
    
    const processedTrades: TradeFormData[] = [];
    
    // Process each group of trades
    for (const instrumentKey in tradeGroups) {
      const instrumentTrades = tradeGroups[instrumentKey];
      
      // In broker format:
      // BUY = LONG (entry)
      // SELL = SHORT (exit)
      const longTrades = instrumentTrades?.filter(t => t.type === 'LONG') || [];
      const shortTrades = instrumentTrades?.filter(t => t.type === 'SHORT') || [];
      
      // Group trades by "trade sequence" - a sequence starts with LONGs and ends with a SHORT
      // We'll identify trade sequences by looking at the timing
      const tradeSequences: {
        longs: TradeFormData[],
        short: TradeFormData | null,
        totalQty: number,
        avgEntryPrice: number,
        exitPrice: number | null,
        profitLoss: number,
        entryDate: string,
        exitDate: string | null
      }[] = [];
      
      // Initialize with the first sequence
      let currentSequence = {
        longs: [] as TradeFormData[],
        short: null as TradeFormData | null,
        totalQty: 0,
        avgEntryPrice: 0,
        exitPrice: null as number | null,
        profitLoss: 0,
        entryDate: '',
        exitDate: null as string | null
      };
      
      // Sort all trades by date
      const allTradesSorted = [...(instrumentTrades || [])].sort((a, b) => {
        const dateA = new Date(a.entryDate);
        const dateB = new Date(b.entryDate);
        return dateA.getTime() - dateB.getTime();
      });
      
      // Group trades into sequences
      for (const trade of allTradesSorted) {
        if (trade.type === 'LONG') {
          // If we have a completed sequence, start a new one
          if (currentSequence.short !== null) {
            tradeSequences.push({...currentSequence});
            currentSequence = {
              longs: [],
              short: null,
              totalQty: 0,
              avgEntryPrice: 0,
              exitPrice: null,
              profitLoss: 0,
              entryDate: '',
              exitDate: null
            };
          }
          
          // Add this LONG to the current sequence
          currentSequence.longs.push(trade);
          
          // Update sequence info
          const oldTotalValue = currentSequence.avgEntryPrice * currentSequence.totalQty;
          const newValue = trade.entryPrice * trade.quantity;
          currentSequence.totalQty += trade.quantity;
          currentSequence.avgEntryPrice = (oldTotalValue + newValue) / currentSequence.totalQty;
          
          // Set entry date to the earliest LONG
          if (!currentSequence.entryDate || new Date(trade.entryDate) < new Date(currentSequence.entryDate)) {
            currentSequence.entryDate = safeToISOString(trade.entryDate);
          }
        } else if (trade.type === 'SHORT') {
          // If this SHORT matches the current sequence's quantity
          if (trade.quantity === currentSequence.totalQty) {
            // Complete this sequence
            currentSequence.short = trade;
            currentSequence.exitPrice = trade.entryPrice;
            currentSequence.exitDate = safeToISOString(trade.entryDate);
            currentSequence.profitLoss = (trade.entryPrice - currentSequence.avgEntryPrice) * currentSequence.totalQty;
            
            tradeSequences.push({...currentSequence});
            
            // Reset for next sequence
            currentSequence = {
              longs: [],
              short: null,
              totalQty: 0,
              avgEntryPrice: 0,
              exitPrice: null,
              profitLoss: 0,
              entryDate: '',
              exitDate: null
            };
          } else {
            // This is a partial exit or doesn't match any sequence
            // For now, just add it as a standalone trade
            processedTrades.push(trade);
          }
        }
      }
      
      // Add any incomplete sequence
      if (currentSequence.longs.length > 0) {
        tradeSequences.push(currentSequence);
      }
      
      // Create consolidated trades from sequences
      for (const sequence of tradeSequences) {
        if (sequence.longs.length > 0) {
          // Create a consolidated trade for this sequence
          const firstLong = sequence.longs[0];
          
          if (firstLong) {
            const consolidatedTrade: TradeFormData = {
              symbol: firstLong.symbol,
              type: 'LONG', // Always show as LONG for consolidated view
              instrumentType: firstLong.instrumentType,
              entryPrice: sequence.avgEntryPrice,
              exitPrice: sequence.exitPrice,
              quantity: sequence.totalQty,
              strikePrice: firstLong.strikePrice,
              expiryDate: safeToISOString(firstLong.expiryDate),
              optionType: firstLong.optionType,
              entryDate: sequence.entryDate,
              exitDate: sequence.exitDate,
              profitLoss: sequence.profitLoss,
              notes: `Consolidated trade (${sequence.longs.length} entries)`,
              sector: firstLong.sector,
            };
            
            processedTrades.push(consolidatedTrade);
          }
        }
      }
    }
    
    return processedTrades;
  };

  return (
    <>
      <div className="flex gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="file" accept=".csv" onChange={handleImportCSV} className="sr-only" />
          <button
            onClick={() => document.querySelector<HTMLInputElement>('input[type="file"][accept=".csv"]')?.click()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
          >
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v18" />
            </svg>
            Import CSV
          </button>
        </label>

        <button
          onClick={downloadSampleCSV}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Sample CSV
        </button>
      </div>

      {importMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mt-4" role="alert">
          <span className="block sm:inline">{importMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
          <span className="block sm:inline">{error}</span>
          <button
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
          >
            <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Import Trades from CSV</h3>
                <button 
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setShowImportModal(false);
                    setCsvFile(null);
                    setCsvPreview([]);
                  }}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Preview of the first 5 rows from your CSV file:
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {csvPreview.length > 0 && Object.keys(csvPreview[0]).map((header) => (
                          <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {csvPreview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((value: any, j) => (
                            <td key={j} className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setCsvFile(null);
                    setCsvPreview([]);
                  }}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={isImporting}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : 'Import All Trades'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 