/**
 * Universal NSE Options Symbol Parser
 * Parses NSE options symbols to extract underlying, expiry, strike, and option type
 * Works for CSV import and future broker API integrations
 */

import { LOT_SIZES } from '../config/constants';

export interface ParsedOptionsSymbol {
  originalSymbol: string;
  underlying: string;
  expiry: Date;
  strike: number;
  optionType: 'CE' | 'PE' | 'CALL' | 'PUT';
  isValid: boolean;
  error?: string;
}

export interface ParsedFuturesSymbol {
  originalSymbol: string;
  underlying: string;
  expiry: Date;
  isValid: boolean;
  error?: string;
}

/**
 * MCX Commodity Information with lot sizes
 */
export const MCX_COMMODITIES = {
  GOLD: {
    name: 'GOLD',
    lotSize: 100,  // grams
    tickSize: 1,
    symbol: 'GOLD',
    exchange: 'MCX',
    unit: 'grams'
  },
  SILVER: {
    name: 'SILVER',
    lotSize: 30000,  // grams (30 kg)
    tickSize: 1,
    symbol: 'SILVER',
    exchange: 'MCX',
    unit: 'grams'
  },
  CRUDEOIL: {
    name: 'CRUDE OIL',
    lotSize: 100,  // barrels
    tickSize: 1,
    symbol: 'CRUDEOIL',
    exchange: 'MCX',
    unit: 'barrels'
  },
  NATURALGAS: {
    name: 'NATURAL GAS',
    lotSize: 1250,  // mmBtu
    tickSize: 0.10,
    symbol: 'NATURALGAS',
    exchange: 'MCX',
    unit: 'mmBtu'
  },
  COPPER: {
    name: 'COPPER',
    lotSize: 2500,  // kg
    tickSize: 0.05,
    symbol: 'COPPER',
    exchange: 'MCX',
    unit: 'kg'
  },
  ZINC: {
    name: 'ZINC',
    lotSize: 5000,  // kg
    tickSize: 0.05,
    symbol: 'ZINC',
    exchange: 'MCX',
    unit: 'kg'
  }
} as const;

/**
 * NSE Stock Lot Sizes (for futures and options)
 * Most stocks have standard lot sizes, but some popular stocks have specific sizes
 */
export const NSE_STOCK_LOT_SIZES: Record<string, number> = {
  // High-value stocks (smaller lot sizes)
  'RELIANCE': 250,
  'TCS': 150,
  'HDFCBANK': 550,
  'INFY': 300,
  'HINDUNILVR': 300,
  'ITC': 1600,
  'SBIN': 1500,
  'BHARTIARTL': 1800,
  'BAJFINANCE': 125,
  'ASIANPAINT': 150,
  'MARUTI': 100,
  'WIPRO': 1200,
  'TECHM': 700,
  'ULTRACEMCO': 150,
  'TITAN': 300,
  'POWERGRID': 1800,
  'NTPC': 2250,
  'NESTLEIND': 50,
  'KOTAKBANK': 400,
  'LT': 225,
  'AXISBANK': 1200,
  'ICICIBANK': 1375,
  'HCLTECH': 700,
  'SUNPHARMA': 700,
  'BAJAJFINSV': 800,
  'DIVISLAB': 150,
  'ADANIPORTS': 900,
  'TATAMOTORS': 1500,
  'INDUSINDBK': 900,
  'TATASTEEL': 800,
  'DRREDDY': 125,
  'COALINDIA': 2400,
  'BRITANNIA': 200,
  'APOLLOHOSP': 150,
  'CIPLA': 800,
  'GRASIM': 450,
  'HINDALCO': 1750,
  'BPCL': 1000,
  'SHREECEM': 25,
  'HEROMOTOCO': 250,
  'JSWSTEEL': 1100,
  'EICHERMOT': 250,
  'BAJAJ-AUTO': 150,
  'TATACONSUM': 1050,
  'HDFCLIFE': 1200,
  'SBILIFE': 900,
  'ADANIENT': 400,
  'ONGC': 3400,
  
  // Default lot size for other stocks
  'DEFAULT_STOCK': 1000
};

/**
 * Indian Stock Exchange Indices Information with lot sizes
 * Supports both NSE and BSE indices
 */
export const INDIAN_INDICES = {
  NIFTY: {
    name: 'NIFTY 50',
    lotSize: 75,
    tickSize: 0.05,
    symbol: 'NIFTY',
    exchange: 'NSE'
  },
  BANKNIFTY: {
    name: 'BANK NIFTY',
    lotSize: 30, // Corrected current lot size
    tickSize: 0.05,
    symbol: 'BANKNIFTY',
    exchange: 'NSE'
  },
  FINNIFTY: {
    name: 'NIFTY FINANCIAL SERVICES',
    lotSize: 65, // Updated as per your screenshot
    tickSize: 0.05,
    symbol: 'FINNIFTY',
    exchange: 'NSE'
  },
  MIDCPNIFTY: {
    name: 'NIFTY MIDCAP 50',
    lotSize: 140, // Updated as per your screenshot
    tickSize: 0.05,
    symbol: 'MIDCPNIFTY',
    exchange: 'NSE'
  },
  NIFTYNXT50: {
    name: 'NIFTY NEXT 50',
    lotSize: 25, // Updated as per your screenshot
    tickSize: 0.05,
    symbol: 'NIFTYNXT50',
    exchange: 'NSE'
  },
  SENSEX: {
    name: 'BSE SENSEX',
    lotSize: 20,
    tickSize: 0.05,
    symbol: 'SENSEX',
    exchange: 'BSE'
  },
  BANKEX: {
    name: 'BSE BANK INDEX',
    lotSize: 30, // As per your specification
    tickSize: 0.05,
    symbol: 'BANKEX',
    exchange: 'BSE'
  }
} as const;

/**
 * List of known underlying symbols ordered by length (longest first to avoid conflicts)
 * Includes NSE, BSE indices and MCX commodities
 */
const UNDERLYING_SYMBOLS = [
  'NATURALGAS',   // 10 chars - MCX
  'MIDCPNIFTY',   // 10 chars - NSE
  'NIFTYNXT50',   // 10 chars - NSE
  'CRUDEOIL',     // 8 chars - MCX
  'BANKNIFTY',    // 9 chars - NSE
  'FINNIFTY',     // 8 chars - NSE
  'BANKEX',       // 6 chars - BSE
  'SENSEX',       // 6 chars - BSE
  'COPPER',       // 6 chars - MCX
  'SILVER',       // 6 chars - MCX
  'NIFTY',        // 5 chars - NSE
  'GOLD',         // 4 chars - MCX
  'ZINC'          // 4 chars - MCX
];

/**
 * Simple in-memory cache for parsed option symbols to avoid repeated computation during large imports
 */
const optionsSymbolCache: Record<string, ParsedOptionsSymbol> = {};

// Helper: Return the date of the last occurrence of a weekday (0=Sun .. 6=Sat) in a given month
function getLastWeekdayOfMonth(year: number, monthIdx: number, weekday: number): Date {
  const lastDay = new Date(year, monthIdx + 1, 0); // last day of month
  const offset = (lastDay.getDay() - weekday + 7) % 7;
  return new Date(year, monthIdx, lastDay.getDate() - offset);
}

// Helper: Return the date of the nth occurrence of a weekday (1-5) in a month. If nth exceeds the available weeks, returns the last occurrence.
function getNthWeekdayOfMonth(year: number, monthIdx: number, weekday: number, nth: number): Date {
  const firstDay = new Date(year, monthIdx, 1);
  const offset = (weekday - firstDay.getDay() + 7) % 7;
  let day = 1 + offset + (nth - 1) * 7;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  if (day > daysInMonth) {
    day -= 7; // fallback to the previous week if nth week doesn't exist
  }
  return new Date(year, monthIdx, day);
}

/**
 * Universal options symbol parser for NSE, BSE, and MCX
 * 
 * Format: <UNDERLYING><YYMMDD><STRIKE><CE/PE>
 * Examples:
 * - BANKNIFTY26032678000CE → BANKNIFTY, 26-Mar-2026, 78000, CE
 * - TCS2506263500CE → TCS, 26-Jun-2025, 3500, CE
 * - GOLD25063073200CE → GOLD, 30-Jun-2025, 73200, CE
 * - CRUDEOIL2509174300PE → CRUDEOIL, 17-Sep-2025, 4300, PE
 */
export function parseOptionsSymbol(symbol: string): ParsedOptionsSymbol {
  // Return from cache if previously parsed
  if (optionsSymbolCache[symbol]) {
    return optionsSymbolCache[symbol];
  }

  const result: ParsedOptionsSymbol = {
    originalSymbol: symbol,
    underlying: '',
    expiry: new Date(),
    strike: 0,
    optionType: 'CE',
    isValid: false
  };

  try {
    if (!symbol || typeof symbol !== 'string') {
      result.error = 'Invalid symbol format';
      return result;
    }

    const cleanSymbol = symbol.trim().toUpperCase();

    // Option type should be last 2 characters (CE or PE)
    if (cleanSymbol.length < 10) { // Minimum reasonable length for options symbol
      result.error = 'Symbol too short for options format';
      return result;
    }

    const optionTypePart = cleanSymbol.slice(-2);
    if (!['CE', 'PE'].includes(optionTypePart)) {
      result.error = `Invalid option type: ${optionTypePart}. Must be CE or PE`;
      return result;
    }

    result.optionType = optionTypePart as 'CE' | 'PE';

    // Remove option type to get the rest
    const symbolWithoutOption = cleanSymbol.substring(0, cleanSymbol.length - 2);

    // First try to match with known indices/commodities (longest first)
    let underlying = UNDERLYING_SYMBOLS.find(ticker => symbolWithoutOption.startsWith(ticker));
    
    if (!underlying) {
      // If no index/commodity match, extract stock symbol
      // For stocks: TCS2506263500 -> TCS is the underlying
      // Look for the pattern where digits start (indicating date/strike)
      const stockMatch = symbolWithoutOption.match(/^([A-Z&]+)(\d+)$/);
      if (stockMatch) {
        underlying = stockMatch[1];
        
        // Check if this stock exists in our lot sizes (validation)
        if (LOT_SIZES[underlying] === undefined && underlying !== 'DEFAULT_STOCK') {
          // Still allow it but note it's unknown
          console.warn(`Unknown stock underlying: ${underlying}`);
        }
      } else {
        result.error = `Cannot extract underlying from symbol: ${cleanSymbol}`;
        return result;
      }
    }

    if (!underlying) {
      result.error = `Cannot identify underlying symbol from: ${cleanSymbol}`;
      return result;
    }

    result.underlying = underlying;

    // Extract remaining part after underlying (date + strike)
    const remaining = symbolWithoutOption.substring(underlying.length);

    /*
     * Zerodha / Exchange symbol formats (observed June-2025)
     * 1. YYMMDD  – legacy (e.g. BANKNIFTY26032678000CE)
     * 2. YYMMM   – monthly, 3-letter month abbreviation (e.g. NIFTY25JUL26900CE)
     * 3. YYMWW   – weekly, where M = 1-digit month, WW = 2-digit week (e.g. SENSEX2570185000CE → YY=25, M=7, WW=01)
     */

    const monthMap: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
    };

    let strikePart = '';
    let expiryDate: Date | null = null;

    // --- Format-B : YYMMM (monthly, e.g. 25JUL) ------------------------------------
    if (!expiryDate) {
      const monthAbbrMatch = remaining.match(/^(\d{2})([A-Z]{3})(\d+)$/);
      if (monthAbbrMatch) {
        const yearPart = monthAbbrMatch[1];
        const monthAbbr = monthAbbrMatch[2];
        strikePart = monthAbbrMatch[3];

        const monthIdx = monthMap[monthAbbr as keyof typeof monthMap];
        if (monthIdx === undefined) {
          result.error = `Invalid month abbreviation: ${monthAbbr}`;
          return result;
        }

        const year = 2000 + parseInt(yearPart);

        // Use last Thursday (NSE) or Friday (BSE) of the month as approximation
        const expiryWeekdayMap: Record<string, number> = {
          SENSEX: 5,   // Friday
          BANKEX: 5,
          BANKNIFTY: 4, // Thursday
          NIFTY: 4,
          FINNIFTY: 4,
          MIDCPNIFTY: 4,
          NIFTYNXT50: 4
        };

        const weekday = expiryWeekdayMap[result.underlying] ?? 4; // default Thursday

        expiryDate = getLastWeekdayOfMonth(year, monthIdx, weekday);
      }
    }

    // --- Format-C : YYMWW (weekly, e.g. 25701) ------------------------------------
    if (!expiryDate) {
      const weeklyMatch = remaining.match(/^(\d{2})(\d)(\d{2})(\d+)$/); // YY M WW strike
      if (weeklyMatch) {
        const yearPart = weeklyMatch[1];
        const monthDigit = parseInt(weeklyMatch[2]);
        const weekPartStr = weeklyMatch[3];
        const weekNumber = parseInt(weekPartStr);
        strikePart = weeklyMatch[4];

        const year = 2000 + parseInt(yearPart);
        const monthIdx = monthDigit - 1; // 0-indexed

        if (monthIdx < 0 || monthIdx > 11 || weekNumber < 1 || weekNumber > 5) {
          // Not a realistic weekly code – fall through to legacy
        } else {
          const expiryWeekdayMap: Record<string, number> = {
            SENSEX: 5, // Friday
            BANKEX: 5,
            BANKNIFTY: 4, // Thursday
            NIFTY: 4,
            FINNIFTY: 4,
            MIDCPNIFTY: 4,
            NIFTYNXT50: 4
          };
          const weekday = expiryWeekdayMap[result.underlying] ?? 4;

          const nthWeek = weekNumber; // 1,2,3...
          expiryDate = getNthWeekdayOfMonth(year, monthIdx, weekday, nthWeek);
        }
      }
    }

    // --- Format-A : YYMMDD (legacy) -------------------------------------------------
    if (!expiryDate) {
      const legacyMatch = remaining.match(/^(\d{6})(\d+)$/);
      if (legacyMatch) {
        const expiryPart = legacyMatch[1];
        strikePart = legacyMatch[2];

        const year = 2000 + parseInt(expiryPart.substring(0, 2));
        const month = parseInt(expiryPart.substring(2, 4)); // 1-12 expected
        const day = parseInt(expiryPart.substring(4, 6));

        if (month < 1 || month > 12 || day < 1 || day > 31) {
          result.error = `Invalid expiry date: ${expiryPart}`;
          return result;
        }

        expiryDate = new Date(year, month - 1, day);
      }
    }

    if (!expiryDate) {
      result.error = `Unrecognized expiry/strike format: ${remaining}`;
      return result;
    }

    // Validate strike part
    if (!strikePart || !/^\d+$/.test(strikePart)) {
      result.error = `Invalid strike price: ${strikePart}`;
      return result;
    }

    result.expiry = expiryDate;
    result.strike = parseInt(strikePart);

    result.isValid = true;
    // Store successful parse in cache
    optionsSymbolCache[symbol] = result;
    return result;

  } catch (error) {
    result.error = `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return result;
  }
}

/**
 * Parse NSE/BSE/MCX futures symbols
 * 
 * Format: <UNDERLYING><YY><MONTH><FUT>
 * Examples:
 * - NIFTY24AUGFUT → NIFTY, August 2024
 * - BANKNIFTY24JULFUT → BANKNIFTY, July 2024
 * - GOLD24SEPFUT → GOLD, September 2024
 */
export function parseFuturesSymbol(symbol: string): ParsedFuturesSymbol {
  const result: ParsedFuturesSymbol = {
    originalSymbol: symbol,
    underlying: '',
    expiry: new Date(),
    isValid: false
  };

  try {
    if (!symbol || typeof symbol !== 'string') {
      result.error = 'Invalid symbol format';
      return result;
    }

    const cleanSymbol = symbol.trim().toUpperCase();

    if (!cleanSymbol.endsWith('FUT')) {
      result.error = 'Not a futures symbol (must end with FUT)';
      return result;
    }

    // Remove 'FUT' suffix
    const symbolWithoutFut = cleanSymbol.substring(0, cleanSymbol.length - 3);

    // Find matching underlying
    const underlying = UNDERLYING_SYMBOLS.find(ticker => symbolWithoutFut.startsWith(ticker));
    
    if (!underlying) {
      result.error = `Unknown underlying. Supported: ${UNDERLYING_SYMBOLS.join(', ')}`;
      return result;
    }

    result.underlying = underlying;

    // Extract expiry part after underlying
    const expiryPart = symbolWithoutFut.substring(underlying.length);

    // Month mapping
    const monthMap: Record<string, number> = {
      'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
      'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
    };

    // Parse format: 24AUG (YY + 3-letter month)
    if (expiryPart.length !== 5) {
      result.error = `Invalid expiry format: ${expiryPart}. Expected YYMNN (e.g., 24AUG)`;
      return result;
    }

    const yearPart = expiryPart.substring(0, 2);
    const monthPart = expiryPart.substring(2, 5);

    if (!/^\d{2}$/.test(yearPart)) {
      result.error = `Invalid year format: ${yearPart}. Expected 2 digits`;
      return result;
    }

    const monthNumber = monthMap[monthPart];
    if (!monthNumber) {
      result.error = `Invalid month: ${monthPart}. Expected one of: ${Object.keys(monthMap).join(', ')}`;
      return result;
    }

    const year = 2000 + parseInt(yearPart);
    
    // For futures, expiry is typically the last Thursday of the month
    // For simplicity, we'll use the last day of the month
    const expiryDate = new Date(year, monthNumber - 1, 0); // Last day of previous month + 1 = last day of month
    expiryDate.setDate(new Date(year, monthNumber, 0).getDate()); // Last day of the month

    result.expiry = expiryDate;
    result.isValid = true;
    return result;

  } catch (error) {
    result.error = `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return result;
  }
}

/**
 * Legacy NSE options symbol parser (for backward compatibility)
 * 
 * Format: <UNDERLYING><YYMMDD><STRIKE><CE/PE>
 * Examples:
 * - BANKNIFTY26032678000CE → BANKNIFTY, 26-Mar-2026, 78000, CE
 * - FINNIFTY25062615000PE → FINNIFTY, 26-Jun-2025, 15000, PE
 */
export function parseNSEOptionsSymbol(symbol: string): ParsedOptionsSymbol {
  // Use the universal parser for backward compatibility
  return parseOptionsSymbol(symbol);
}

/**
 * Get lot size for a given underlying symbol (works for both indices and commodities)
 */
export function getLotSize(underlying: string): number {
  const symbol = underlying.toUpperCase();
  
  // Prefer centralized LOT_SIZES mapping for consistency across the app
  if (LOT_SIZES[symbol] !== undefined) {
    return LOT_SIZES[symbol];
  }
  
  // Legacy fallbacks for values not yet migrated to LOT_SIZES
  const mcxSymbol = symbol as keyof typeof MCX_COMMODITIES;
  if (MCX_COMMODITIES[mcxSymbol]) {
    return MCX_COMMODITIES[mcxSymbol].lotSize;
  }

  const indexSymbol = symbol as keyof typeof INDIAN_INDICES;
  if (INDIAN_INDICES[indexSymbol]) {
    return INDIAN_INDICES[indexSymbol].lotSize;
  }

  if (NSE_STOCK_LOT_SIZES[symbol]) {
    return NSE_STOCK_LOT_SIZES[symbol];
  }
  
  // Final fallback: assume default lot size if provided, else 1
  return LOT_SIZES['DEFAULT_STOCK'] ?? 1;
}

/**
 * Get index information for a given underlying symbol
 */
export function getIndexInfo(underlying: string) {
  const symbol = underlying.toUpperCase() as keyof typeof INDIAN_INDICES;
  return INDIAN_INDICES[symbol] || null;
}

/**
 * Format parsed symbol for display
 */
export function formatOptionsSymbol(parsed: ParsedOptionsSymbol): string {
  if (!parsed.isValid) return parsed.originalSymbol;
  
  const expiryStr = parsed.expiry.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
  
  const optionTypeStr = parsed.optionType === 'CE' ? 'Call' : 'Put';
  
  return `${parsed.underlying} ${expiryStr} ${parsed.strike} ${optionTypeStr}`;
}

/**
 * Check if symbol is an options symbol
 */
export function isOptionsSymbol(symbol: string): boolean {
  if (!symbol) return false;
  const cleanSymbol = symbol.trim().toUpperCase();
  return cleanSymbol.endsWith('CE') || cleanSymbol.endsWith('PE');
}

/**
 * Check if symbol is a futures symbol
 */
export function isFuturesSymbol(symbol: string): boolean {
  if (!symbol) return false;
  const cleanSymbol = symbol.trim().toUpperCase();
  return cleanSymbol.endsWith('FUT');
}

/**
 * Check if symbol is an index/commodity symbol (vs individual stock)
 */
export function isIndexOrCommoditySymbol(symbol: string): boolean {
  if (!symbol) return false;
  const cleanSymbol = symbol.trim().toUpperCase();
  
  // Check if it starts with any known index or commodity
  return UNDERLYING_SYMBOLS.some(ticker => cleanSymbol.startsWith(ticker));
}

/**
 * Universal symbol parser that handles options, futures, and stocks
 */
export function parseSymbol(symbol: string): {
  type: 'OPTIONS' | 'FUTURES' | 'STOCK';
  underlying: string;
  parsed: ParsedOptionsSymbol | ParsedFuturesSymbol | { symbol: string; isValid: boolean };
} {
  const instrumentType = detectInstrumentType(symbol);
  
  switch (instrumentType) {
    case 'OPTIONS':
      return {
        type: 'OPTIONS',
        underlying: extractUnderlying(symbol),
        parsed: parseOptionsSymbol(symbol)
      };
    case 'FUTURES':
      return {
        type: 'FUTURES', 
        underlying: extractUnderlying(symbol),
        parsed: parseFuturesSymbol(symbol)
      };
    default:
      return {
        type: 'STOCK',
        underlying: symbol,
        parsed: { symbol, isValid: true }
      };
  }
}

/**
 * Extract underlying symbol from any symbol type
 */
function extractUnderlying(symbol: string): string {
  const cleanSymbol = symbol.trim().toUpperCase();
  
  // For index/commodity symbols (check longest first)
  const underlying = UNDERLYING_SYMBOLS.find(ticker => cleanSymbol.startsWith(ticker));
  if (underlying) {
    return underlying;
  }
  
  // For individual stocks, extract the base symbol
  // Common patterns: RELIANCE24JULFUT, TCS2506263500CE, HDFCBANK240725C2500
  if (isOptionsSymbol(cleanSymbol)) {
    // For options: TCS2506263500CE -> extract TCS
    const symbolWithoutOption = cleanSymbol.substring(0, cleanSymbol.length - 2);
    const stockMatch = symbolWithoutOption.match(/^([A-Z&]+)(\d+)$/);
    return stockMatch ? stockMatch[1] : cleanSymbol;
  } else if (isFuturesSymbol(cleanSymbol)) {
    // For futures: RELIANCE24JULFUT -> extract RELIANCE
    const symbolWithoutFut = cleanSymbol.substring(0, cleanSymbol.length - 3);
    const stockMatch = symbolWithoutFut.match(/^([A-Z&]+)/);
    return stockMatch ? stockMatch[1] : cleanSymbol;
  } else {
    // For regular stocks: just return the symbol itself (could be stock code)
    const stockMatch = cleanSymbol.match(/^([A-Z&]+)/);
    return stockMatch ? stockMatch[1] : symbol;
  }
}

/**
 * Auto-detect instrument type from symbol
 */
export function detectInstrumentType(symbol: string): 'STOCK' | 'FUTURES' | 'OPTIONS' {
  if (isOptionsSymbol(symbol)) {
    return 'OPTIONS';
  }
  
  if (isFuturesSymbol(symbol)) {
    return 'FUTURES';
  }
  
  // Check if it's a known index/commodity (could be futures or stocks)
  const underlying = UNDERLYING_SYMBOLS.find(ticker => 
    symbol.toUpperCase().startsWith(ticker)
  );
  
  if (underlying && symbol.length > underlying.length) {
    // Has additional info after underlying, could be futures/options
    return 'FUTURES'; // Default to futures if not already identified as options
  }
  
  return 'STOCK';
}

/**
 * Batch parse multiple symbols (useful for CSV import)
 */
export function parseMultipleSymbols(symbols: string[]): ParsedOptionsSymbol[] {
  return symbols.map(symbol => parseNSEOptionsSymbol(symbol));
}

/**
 * Attempt to correct malformed NSE options symbols
 * Common issues:
 * - Extra digits in strike price (e.g., 668400 instead of 68400)
 * - Missing leading zeros in dates
 */
export function correctMalformedSymbol(symbol: string): string {
  if (!symbol || !isOptionsSymbol(symbol)) {
    return symbol;
  }

  try {
    const cleanSymbol = symbol.trim().toUpperCase();
    
    // Find the underlying
    const underlying = UNDERLYING_SYMBOLS.find(ticker => cleanSymbol.startsWith(ticker));
    if (!underlying) {
      return symbol; // Can't correct unknown underlying
    }

    const remaining = cleanSymbol.substring(underlying.length);
    const optionType = remaining.slice(-2);
    
    if (!['CE', 'PE'].includes(optionType)) {
      return symbol; // Can't correct invalid option type
    }

    // Extract the middle part (date + strike)
    const middlePart = remaining.substring(0, remaining.length - 2);
    
    // Date should be 6 digits (YYMMDD)
    if (middlePart.length < 8) {
      return symbol; // Too short to have both date and strike
    }

    // Extract the first 6 digits as date
    const datePart = middlePart.substring(0, 6);
    const strikePart = middlePart.substring(6);
    
    // Common correction: If strike has extra leading digits, try to fix it
    // For BANKNIFTY, typical strikes are 5-digit numbers (e.g., 52000, 68400)
    // If we see 6+ digits starting with 6, it might be 668400 instead of 68400
    let correctedStrike = strikePart;
    
    if (underlying === 'BANKNIFTY' && strikePart.length >= 6) {
      // Check for common pattern: 6XXXXX where it should be XXXXX
      if (strikePart.startsWith('6') && strikePart.length === 6) {
        const possibleStrike = strikePart.substring(1); // Remove first 6
        const strikeNum = parseInt(possibleStrike);
        
        // Check if this makes sense for BANKNIFTY (typically 40000-80000 range)
        if (strikeNum >= 40000 && strikeNum <= 80000) {
          correctedStrike = possibleStrike;
          console.log(`🔧 Corrected BANKNIFTY strike: ${strikePart} → ${correctedStrike}`);
        }
      }
    }
    
    // Similar logic can be added for other underlyings if needed
    if (underlying === 'NIFTY' && strikePart.length >= 6) {
      if (strikePart.startsWith('2') && strikePart.length === 6) {
        const possibleStrike = strikePart.substring(1);
        const strikeNum = parseInt(possibleStrike);
        
        // NIFTY typically trades 18000-30000 range
        if (strikeNum >= 18000 && strikeNum <= 30000) {
          correctedStrike = possibleStrike;
          console.log(`🔧 Corrected NIFTY strike: ${strikePart} → ${correctedStrike}`);
        }
      }
    }

    const correctedSymbol = `${underlying}${datePart}${correctedStrike}${optionType}`;
    
    if (correctedSymbol !== symbol) {
      console.log(`🔧 Symbol correction: ${symbol} → ${correctedSymbol}`);
    }
    
    return correctedSymbol;
    
  } catch (error) {
    console.error('Error correcting symbol:', error);
    return symbol; // Return original if correction fails
  }
}

/**
 * Parse NSE options symbol with automatic correction attempt
 */
export function parseNSEOptionsSymbolWithCorrection(symbol: string): ParsedOptionsSymbol {
  // First try parsing as-is
  let result = parseNSEOptionsSymbol(symbol);
  
  // If parsing failed, try with correction
  if (!result.isValid && isOptionsSymbol(symbol)) {
    const correctedSymbol = correctMalformedSymbol(symbol);
    if (correctedSymbol !== symbol) {
      result = parseNSEOptionsSymbol(correctedSymbol);
      if (result.isValid) {
        result.originalSymbol = symbol; // Keep track of original
        console.log(`✅ Successfully parsed corrected symbol: ${symbol} → ${correctedSymbol}`);
      }
    }
  }
  
  return result;
}

// Export types for use in other files
export type IndianUnderlying = keyof typeof INDIAN_INDICES;
export type OptionType = 'CE' | 'PE'; 