export interface Trade {
  id?: number;
  symbol: string;
  type: 'LONG' | 'SHORT';
  instrumentType: 'STOCK' | 'FUTURES' | 'OPTIONS';
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  strikePrice?: number | null;
  expiryDate?: string | Date | null;
  optionType?: 'CALL' | 'PUT' | null;
  premium?: number | null;
  profitLoss?: number | null;
  entryDate: string | Date;
  exitDate?: string | Date | null;
  notes?: string | null;
  
  // Advanced journal fields
  strategy?: string | null;
  lessons?: string | null;
  lessonsLearned?: string | null;
  riskRewardRatio?: number | null;
  stopLoss?: number | null;
  targetPrice?: number | null;
  timeFrame?: string | null;
  marketCondition?: string | null;
  preTradeEmotion?: string | null;
  postTradeEmotion?: string | null;
  tradeConfidence?: number | null;
  confidenceLevel?: number | null;
  tradeRating?: number | null;
  rating?: number | null;
  setupImageUrl?: string | null;
  setupDescription?: string | null;
  sector?: string | null;

  createdAt?: string | Date;
  updatedAt?: string | Date;

  // Added for sync and dashboard
  isSynced?: boolean;
  lastSyncAt?: string | Date | null;
}

export type TradeFormData = Trade;

// API-compatible version with string dates for server communication
export interface ApiTrade {
  id?: number;
  symbol: string;
  type: 'LONG' | 'SHORT';
  instrumentType: 'STOCK' | 'FUTURES' | 'OPTIONS';
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  strikePrice?: number | null;
  expiryDate?: string | null;
  optionType?: 'CALL' | 'PUT' | null;
  premium?: number | null;
  profitLoss?: number | null;
  entryDate: string;
  exitDate?: string | null;
  notes?: string | null;
  
  // Advanced journal fields
  strategy?: string | null;
  lessons?: string | null;
  lessonsLearned?: string | null;
  riskRewardRatio?: number | null;
  stopLoss?: number | null;
  targetPrice?: number | null;
  timeFrame?: string | null;
  marketCondition?: string | null;
  preTradeEmotion?: string | null;
  postTradeEmotion?: string | null;
  tradeConfidence?: number | null;
  confidenceLevel?: number | null;
  tradeRating?: number | null;
  rating?: number | null;
  setupImageUrl?: string | null;
  setupDescription?: string | null;
  sector?: string | null;

  createdAt?: string;
  updatedAt?: string;

  // Added for sync and dashboard
  isSynced?: boolean;
  lastSyncAt?: string | null;
} 