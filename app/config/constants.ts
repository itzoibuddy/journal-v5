/**
 * Constants file for the MyTradingJournal app
 * Contains all hardcoded values used throughout the application to improve maintainability
 */

/**
 * Instrument Types enum
 * Represents the different types of tradable instruments
 */
export enum InstrumentType {
  STOCK = 'STOCK',
  FUTURES = 'FUTURES',
  OPTIONS = 'OPTIONS'
}

/**
 * Trade Type enum
 * Represents the direction of a trade (long or short)
 */
export enum TradeType {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

/**
 * Option Type enum
 * Represents the type of an option contract
 */
export enum OptionType {
  CALL = 'CALL',
  PUT = 'PUT'
}

/**
 * Lot Sizes for different indices and commodities (Updated with current NSE, BSE, and MCX lot sizes)
 * Each index/commodity has a specific lot size for derivatives trading
 * Note: These change periodically as per NSE/BSE/MCX notifications
 * Last updated: July 2025
 */
export const LOT_SIZES: Record<string, number> = {
  // NSE Indices
  NIFTY: 75,
  BANKNIFTY: 35,        // Updated lot size
  FINNIFTY: 65,         // Updated as per NSE
  MIDCPNIFTY: 140,      // Updated as per NSE
  NIFTYNXT50: 25,       // Updated as per NSE
  // BSE Indices
  SENSEX: 20,           // BSE
  BANKEX: 30,           // BSE Bank Index
  // MCX Commodities
  GOLD: 100,            // 100 grams
  SILVER: 30000,        // 30 kg (30,000 grams)
  CRUDEOIL: 100,        // 100 barrels
  NATURALGAS: 1250,     // 1250 mmBtu
  COPPER: 2500,         // 2.5 tons (2500 kg)
  ZINC: 5000,           // 5 tons (5000 kg)
  
  // NSE F&O Stocks (Updated July 2025)
  '360ONE': 500,
  AARTIIND: 1325,
  ABB: 125,
  ABCAPITAL: 3100,
  ABFRL: 2600,
  ACC: 300,
  ADANIENSOL: 675,
  ADANIENT: 300,
  ADANIGREEN: 600,
  ADANIPORTS: 475,
  ALKEM: 125,
  AMBER: 100,
  AMBUJACEM: 1050,
  ANGELONE: 250,
  APLAPOLLO: 350,
  APOLLOHOSP: 125,
  ASHOKLEY: 2500,
  ASIANPAINT: 250,
  ASTRAL: 425,
  ATGL: 875,
  AUBANK: 1000,
  AUROPHARMA: 550,
  AXISBANK: 625,
  'BAJAJ-AUTO': 75,
  BAJAJFINSV: 500,
  BAJFINANCE: 750,
  BALKRISIND: 300,
  BANDHANBNK: 3600,
  BANKBARODA: 2925,
  BANKINDIA: 5200,
  BDL: 325,
  BEL: 2850,
  BHARATFORG: 500,
  BHARTIARTL: 475,
  BHEL: 2625,
  BIOCON: 2500,
  BLUESTARCO: 325,
  BOSCHLTD: 25,
  BPCL: 1975,
  BRITANNIA: 125,
  BSE: 375,
  BSOFT: 1300,
  CAMS: 150,
  CANBK: 6750,
  CDSL: 475,
  CESC: 3625,
  CGPOWER: 850,
  CHAMBLFERT: 950,
  CHOLAFIN: 625,
  CIPLA: 375,
  COALINDIA: 1350,
  COFORGE: 375,
  COLPAL: 225,
  CONCOR: 1000,
  CROMPTON: 1800,
  CUMMINSIND: 200,
  CYIENT: 425,
  DABUR: 1250,
  DALBHARAT: 325,
  DELHIVERY: 2075,
  DIVISLAB: 100,
  DIXON: 50,
  DLF: 825,
  DMART: 150,
  DRREDDY: 625,
  EICHERMOT: 175,
  ETERNAL: 2425,
  EXIDEIND: 1800,
  FEDERALBNK: 5000,
  FORTIS: 775,
  GAIL: 3150,
  GLENMARK: 375,
  GMRAIRPORT: 6975,
  GODREJCP: 500,
  GODREJPROP: 275,
  GRANULES: 1075,
  GRASIM: 250,
  HAL: 150,
  HAVELLS: 500,
  HCLTECH: 350,
  HDFCAMC: 150,
  HDFCBANK: 550,
  HDFCLIFE: 1100,
  HEROMOTOCO: 150,
  HFCL: 6450,
  HINDALCO: 1400,
  HINDCOPPER: 2650,
  HINDPETRO: 2025,
  HINDUNILVR: 300,
  HINDZINC: 1225,
  HUDCO: 2775,
  ICICIBANK: 700,
  ICICIGI: 325,
  ICICIPRULI: 925,
  IDEA: 71475,
  IDFCFIRSTB: 9275,
  IEX: 3750,
  IGL: 2750,
  IIFL: 1650,
  INDHOTEL: 1000,
  INDIANB: 1000,
  INDIGO: 150,
  INDUSINDBK: 700,
  INDUSTOWER: 1700,
  INFY: 400,
  INOXWIND: 3225,
  IOC: 4875,
  IRB: 11675,
  IRCTC: 875,
  IREDA: 3450,
  IRFC: 4250,
  ITC: 1600,
  JINDALSTEL: 625,
  JIOFIN: 2350,
  JSL: 850,
  JSWENERGY: 1000,
  JSWSTEEL: 675,
  JUBLFOOD: 1250,
  KALYANKJIL: 1175,
  KAYNES: 100,
  KEI: 175,
  KFINTECH: 450,
  KOTAKBANK: 400,
  KPITTECH: 400,
  LAURUSLABS: 1700,
  LICHSGFIN: 1000,
  LICI: 700,
  LODHA: 450,
  LT: 175,
  LTF: 4462,
  LTIM: 150,
  LUPIN: 425,
  'M&M': 200,
  'M&MFIN': 2056,
  MANAPPURAM: 3000,
  MANKIND: 225,
  MARICO: 1200,
  MARUTI: 50,
  MAXHEALTH: 525,
  MAZDOCK: 175,
  MCX: 125,
  MFSL: 800,
  MGL: 400,
  MOTHERSON: 4100,
  MPHASIS: 275,
  MUTHOOTFIN: 275,
  NATIONALUM: 3750,
  NAUKRI: 375,
  NBCC: 6500,
  NCC: 2700,
  NESTLEIND: 250,
  NHPC: 6400,
  NMDC: 13500,
  NTPC: 1500,
  NYKAA: 3125,
  OBEROIRLTY: 350,
  OFSS: 75,
  OIL: 1400,
  ONGC: 2250,
  PAGEIND: 15,
  PATANJALI: 300,
  PAYTM: 725,
  PEL: 750,
  PERSISTENT: 100,
  PETRONET: 1800,
  PFC: 1300,
  PGEL: 700,
  PHOENIXLTD: 350,
  PIDILITIND: 250,
  PIIND: 175,
  PNB: 8000,
  PNBHOUSING: 650,
  POLICYBZR: 350,
  POLYCAB: 125,
  POONAWALLA: 1700,
  POWERGRID: 1900,
  PPLPHARMA: 2500,
  PRESTIGE: 450,
  RBLBANK: 3175,
  RECLTD: 1275,
  RELIANCE: 500,
  RVNL: 1375,
  SAIL: 4700,
  SBICARD: 800,
  SBILIFE: 375,
  SBIN: 750,
  SHREECEM: 25,
  SHRIRAMFIN: 825,
  SIEMENS: 125,
  SJVN: 5875,
  SOLARINDS: 75,
  SONACOMS: 1050,
  SRF: 200,
  SUNPHARMA: 350,
  SUPREMEIND: 175,
  SYNGENE: 1000,
  TATACHEM: 650,
  TATACOMM: 350,
  TATACONSUM: 550,
  TATAELXSI: 100,
  TATAMOTORS: 800,
  TATAPOWER: 1450,
  TATASTEEL: 5500,
  TATATECH: 800,
  TCS: 175,
  TECHM: 600,
  TIINDIA: 200,
  TITAGARH: 725,
  TITAN: 175,
  TORNTPHARM: 250,
  TORNTPOWER: 375,
  TRENT: 100,
  TVSMOTOR: 350,
  ULTRACEMCO: 50,
  UNIONBANK: 4425,
  UNITDSPR: 400,
  UNOMINDA: 550,
  UPL: 1355,
  VBL: 1025,
  VEDL: 1150,
  VOLTAS: 375,
  WIPRO: 3000,
  YESBANK: 31100,
  ZYDUSLIFE: 900,
  
  // Default for unknown stocks
  DEFAULT_STOCK: 1000
};

/**
 * Default strike prices for different indices
 * Used as fallbacks when parsing trade data without explicit strike prices
 */
export const DEFAULT_STRIKE_PRICES: Record<string, number> = {
  // NSE/BSE Indices
  NIFTY: 24900,
  BANKNIFTY: 45000,
  FINNIFTY: 15000,
  MIDCPNIFTY: 13000,
  NIFTYNXT50: 33500,
  SENSEX: 81500,
  BANKEX: 61000,        // BSE Bank Index
  
  // MCX Commodities (representative prices)
  GOLD: 73000,          // ₹/10g
  SILVER: 100000,       // ₹/kg
  CRUDEOIL: 7000,       // ₹/barrel
  NATURALGAS: 300,      // ₹/mmBtu
  COPPER: 800,          // ₹/kg
  ZINC: 280,            // ₹/kg
  
  // Popular NSE Stocks (approximate current levels for options)
  RELIANCE: 3000,
  TCS: 4500,
  HDFCBANK: 1800,
  INFY: 1900,
  HINDUNILVR: 2800,
  ITC: 500,
  SBIN: 900,
  BHARTIARTL: 1700,
  BAJFINANCE: 7500,
  ASIANPAINT: 3000,
  MARUTI: 12000,
  WIPRO: 650,
  TECHM: 1800,
  ULTRACEMCO: 11000,
  TITAN: 3500,
  POWERGRID: 350,
  NTPC: 450,
  NESTLEIND: 2500,
  KOTAKBANK: 1900,
  LT: 3800,
  AXISBANK: 1200,
  ICICIBANK: 1300,
  HCLTECH: 1900,
  SUNPHARMA: 1800,
  BAJAJFINSV: 1600,
  DIVISLAB: 6000,
  ADANIPORTS: 1500,
  TATAMOTORS: 1100,
  INDUSINDBK: 1000,
  TATASTEEL: 180,
  DRREDDY: 7000,
  COALINDIA: 450,
  BRITANNIA: 5500,
  APOLLOHOSP: 7000,
  CIPLA: 1700,
  GRASIM: 2800,
  HINDALCO: 700,
  BPCL: 300,
  SHREECEM: 27000,
  HEROMOTOCO: 4500,
  JSWSTEEL: 1000,
  EICHERMOT: 5000,
  'BAJAJ-AUTO': 9000,
  TATACONSUM: 1000,
  HDFCLIFE: 600,
  SBILIFE: 1600,
  ADANIENT: 3000,
  ONGC: 350,
  
  // Default fallback
  DEFAULT: 0
};

/**
 * Time frames available for trade analysis
 */
export const TIME_FRAMES = [
  { value: '1m', label: '1 minute' },
  { value: '2m', label: '2 minutes' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' }
];

/**
 * Market conditions for trade context
 */
export const MARKET_CONDITIONS = [
  { value: 'Bullish', label: 'Bullish' },
  { value: 'Bearish', label: 'Bearish' },
  { value: 'Sideways', label: 'Sideways' },
  { value: 'Volatile', label: 'Volatile' },
  { value: 'Trending', label: 'Trending' },
  { value: 'Ranging', label: 'Ranging' }
];

/**
 * Pre-trade emotions for psychological analysis
 */
export const PRE_TRADE_EMOTIONS = [
  { value: 'Confident', label: 'Confident' },
  { value: 'Nervous', label: 'Nervous' },
  { value: 'Excited', label: 'Excited' },
  { value: 'Fearful', label: 'Fearful' },
  { value: 'Calm', label: 'Calm' },
  { value: 'Impatient', label: 'Impatient' },
  { value: 'Greedy', label: 'Greedy' },
  { value: 'Uncertain', label: 'Uncertain' }
];

/**
 * Post-trade emotions for psychological analysis
 */
export const POST_TRADE_EMOTIONS = [
  { value: 'Satisfied', label: 'Satisfied' },
  { value: 'Disappointed', label: 'Disappointed' },
  { value: 'Relieved', label: 'Relieved' },
  { value: 'Frustrated', label: 'Frustrated' },
  { value: 'Proud', label: 'Proud' },
  { value: 'Regretful', label: 'Regretful' },
  { value: 'Indifferent', label: 'Indifferent' },
  { value: 'Excited', label: 'Excited' }
];

/**
 * CSV headers for standardized import format
 */
export const CSV_HEADERS = [
  'symbol',
  'type',
  'instrumentType',
  'entryPrice',
  'exitPrice',
  'quantity',
  'strikePrice',
  'expiryDate',
  'optionType',
  'entryDate',
  'exitDate',
  'profitLoss',
  'notes',
  'sector',
  'strategy',
  'timeFrame',
  'marketCondition',
  'stopLoss',
  'targetPrice',
  'riskRewardRatio',
  'preTradeEmotion',
  'postTradeEmotion',
  'tradeConfidence',
  'tradeRating',
  'lessons',
  'setupImageUrl'
];

/**
 * CSV headers alternative forms for better import compatibility
 */
export const CSV_HEADER_ALIASES: Record<string, string[]> = {
  'symbol': ['symbol'],
  'type': ['type'],
  'instrumentType': ['instrumenttype', 'instrument type', 'instrumentType'],
  'entryPrice': ['entryprice', 'entry price', 'entryPrice'],
  'exitPrice': ['exitprice', 'exit price', 'exitPrice'],
  'quantity': ['quantity', 'qty'],
  'strikePrice': ['strikeprice', 'strike price', 'strikePrice'],
  'expiryDate': ['expirydate', 'expiry date', 'expiryDate'],
  'optionType': ['optiontype', 'option type', 'optionType'],
  'entryDate': ['entrydate', 'entry date', 'entryDate'],
  'exitDate': ['exitdate', 'exit date', 'exitDate'],
  'profitLoss': ['profitloss', 'profit/loss', 'profitLoss'],
  'notes': ['notes'],
  'sector': ['sector']
};

/**
 * Broker format identifiers for CSV import
 */
export const BROKER_FORMAT_IDENTIFIERS = [
  'time', 'Time',
  'type', 'Type',
  'instrument', 'Instrument',
  'qty', 'qty.', 'Qty', 'Qty.',
  'avg. price', 'Avg. price'
];

/**
 * Default values for trade form
 */
export const DEFAULT_TRADE_FORM_VALUES = {
  instrumentType: InstrumentType.STOCK,
  type: TradeType.LONG,
  quantity: 1,
  entryPrice: 0,
  tradeConfidence: 5,
  tradeRating: 5,
  timeFrame: 'Daily'
};

/**
 * Time frames for trade summary filtering
 */
export const SUMMARY_TIME_FRAMES = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' }
];

/**
 * NSE Indices with full information (Updated July 2025)
 */
export const NSE_INDICES_LIST = [
  { value: 'NIFTY', label: 'NIFTY 50', lotSize: 75 },
  { value: 'BANKNIFTY', label: 'BANK NIFTY', lotSize: 35 },
  { value: 'FINNIFTY', label: 'NIFTY FINANCIAL SERVICES', lotSize: 65 },
  { value: 'MIDCPNIFTY', label: 'NIFTY MIDCAP 50', lotSize: 140 },
  { value: 'NIFTYNXT50', label: 'NIFTY NEXT 50', lotSize: 25 },
  { value: 'SENSEX', label: 'BSE SENSEX', lotSize: 20 }
];

/**
 * Popular stocks for dropdown (expanded with actively traded F&O stocks)
 */
export const POPULAR_STOCKS = [
  { value: 'RELIANCE', label: 'Reliance Industries' },
  { value: 'TCS', label: 'Tata Consultancy Services' },
  { value: 'HDFCBANK', label: 'HDFC Bank' },
  { value: 'INFY', label: 'Infosys' },
  { value: 'ICICIBANK', label: 'ICICI Bank' },
  { value: 'HINDUNILVR', label: 'Hindustan Unilever' },
  { value: 'SBIN', label: 'State Bank of India' },
  { value: 'BHARTIARTL', label: 'Bharti Airtel' },
  { value: 'ITC', label: 'ITC Limited' },
  { value: 'KOTAKBANK', label: 'Kotak Mahindra Bank' },
  { value: 'AXISBANK', label: 'Axis Bank' },
  { value: 'BAJFINANCE', label: 'Bajaj Finance' },
  { value: 'BAJAJFINSV', label: 'Bajaj Finserv' },
  { value: 'ASIANPAINT', label: 'Asian Paints' },
  { value: 'MARUTI', label: 'Maruti Suzuki' },
  { value: 'WIPRO', label: 'Wipro' },
  { value: 'TECHM', label: 'Tech Mahindra' },
  { value: 'ULTRACEMCO', label: 'UltraTech Cement' },
  { value: 'TITAN', label: 'Titan Company' },
  { value: 'POWERGRID', label: 'Power Grid Corporation' },
  { value: 'NTPC', label: 'NTPC Limited' },
  { value: 'NESTLEIND', label: 'Nestle India' },
  { value: 'LT', label: 'Larsen & Toubro' },
  { value: 'HCLTECH', label: 'HCL Technologies' },
  { value: 'SUNPHARMA', label: 'Sun Pharmaceutical' },
  { value: 'DIVISLAB', label: "Dr. Reddy's Laboratories" },
  { value: 'ADANIPORTS', label: 'Adani Ports & SEZ' },
  { value: 'TATAMOTORS', label: 'Tata Motors' },
  { value: 'INDUSINDBK', label: 'IndusInd Bank' },
  { value: 'TATASTEEL', label: 'Tata Steel' }
];

/**
 * Option types for options trading
 */
export const OPTION_TYPES = [
  { value: 'CE', label: 'Call (CE)' },
  { value: 'PE', label: 'Put (PE)' }
];

/**
 * Pagination default values
 */
export const PAGINATION_DEFAULTS = {
  tradesPerPage: 10
};

/**
 * Table column configuration with default visibility settings
 */
export const TABLE_COLUMNS = {
  symbol: { label: 'Symbol', defaultVisible: true },
  type: { label: 'Type', defaultVisible: true },
  strategy: { label: 'Strategy', defaultVisible: true },
  entryPrice: { label: 'Entry Price', defaultVisible: true },
  exitPrice: { label: 'Exit Price', defaultVisible: true },
  quantity: { label: 'Quantity', defaultVisible: true },
  strikePrice: { label: 'Strike Price', defaultVisible: true },
  profitLoss: { label: 'P/L', defaultVisible: true },
  rating: { label: 'Rating', defaultVisible: true },
  entryDate: { label: 'Entry Date', defaultVisible: true },
  actions: { label: 'Actions', defaultVisible: true }
}; 