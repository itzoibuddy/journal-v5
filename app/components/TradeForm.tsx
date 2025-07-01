'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createTrade, updateTrade, TradeFormData } from '../actions/trade';
import {
  InstrumentType,
  TradeType,
  LOT_SIZES,
  TIME_FRAMES,
  MARKET_CONDITIONS,
  PRE_TRADE_EMOTIONS,
  POST_TRADE_EMOTIONS,
  DEFAULT_TRADE_FORM_VALUES
} from '../config/constants';

const tradeSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  type: z.enum(['LONG', 'SHORT']),
  instrumentType: z.enum(['STOCK', 'FUTURES', 'OPTIONS']).default('STOCK'),
  entryPrice: z.number().positive('Entry price must be positive'),
  exitPrice: z.number().optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  strikePrice: z.number().positive('Strike price must be positive').optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  optionType: z.enum(['CALL', 'PUT']).optional().nullable(),
  entryDate: z.string(),
  exitDate: z.string().optional().nullable(),
  profitLoss: z.number().optional().nullable(),
  notes: z.string().optional(),
  sector: z.string().optional().nullable(),
  strategy: z.string().optional(),
  timeFrame: z.string().optional(),
  marketCondition: z.string().optional(),
  stopLoss: z.number().optional(),
  targetPrice: z.number().optional(),
  riskRewardRatio: z.number().optional(),
  preTradeEmotion: z.string().optional(),
  postTradeEmotion: z.string().optional(),
  tradeConfidence: z.number().optional(),
  tradeRating: z.number().optional(),
  lessons: z.string().optional(),
  setupImageUrl: z.string().optional(),
});

// Helper function to calculate lot size for a symbol
const getLotSize = (symbol: string): number => {
  return LOT_SIZES[symbol] ?? LOT_SIZES.DEFAULT;
};

interface TradeFormProps {
  initialData?: (TradeFormData & { id?: number }) | undefined;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function TradeForm({ initialData, onSuccess, onCancel }: TradeFormProps) {
  const [selectedInstrumentType, setSelectedInstrumentType] = useState<string>(initialData?.instrumentType || 'STOCK');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<TradeFormData>({
    resolver: zodResolver(tradeSchema),
    defaultValues: DEFAULT_TRADE_FORM_VALUES
  });

  // Format number to always display 2 decimal places
  const formatNumber = (value: number | null | undefined): number => {
    if (value === null || value === undefined) return 0.00;
    return parseFloat(Number(value).toFixed(2));
  };

  // Add the watch variables for calculations
  const watchType = watch('type');
  const watchInstrumentType = watch('instrumentType');
  const watchEntryPrice = watch('entryPrice');
  const watchExitPrice = watch('exitPrice');
  const watchQuantity = watch('quantity');
  const watchOptionType = watch('optionType');
  const watchStrikePrice = watch('strikePrice');
  const watchStopLoss = watch('stopLoss');
  const watchTargetPrice = watch('targetPrice');

  // Auto-calculate profit/loss
  useEffect(() => {
    if (watchEntryPrice && watchExitPrice && watchQuantity) {
      let profitLoss = 0;
      
      if (watchType === TradeType.LONG) {
        profitLoss = (watchExitPrice - watchEntryPrice) * watchQuantity;
      } else { // SHORT
        profitLoss = (watchEntryPrice - watchExitPrice) * watchQuantity;
      }
      
      setValue('profitLoss', formatNumber(profitLoss));
    }
  }, [watchType, watchEntryPrice, watchExitPrice, watchQuantity, setValue]);

  // Auto-calculate risk-reward ratio
  useEffect(() => {
    if (watchEntryPrice && watchStopLoss && watchTargetPrice) {
      let risk = 0;
      let reward = 0;
      let riskRewardRatio = 0;
      
      if (watchType === TradeType.LONG) {
        risk = Math.abs(watchEntryPrice - watchStopLoss);
        reward = Math.abs(watchTargetPrice - watchEntryPrice);
      } else { // SHORT
        risk = Math.abs(watchStopLoss - watchEntryPrice);
        reward = Math.abs(watchEntryPrice - watchTargetPrice);
      }
      
      if (risk > 0) {
        riskRewardRatio = parseFloat((reward / risk).toFixed(2));
        setValue('riskRewardRatio', riskRewardRatio);
      }
    }
  }, [watchType, watchEntryPrice, watchStopLoss, watchTargetPrice, setValue]);

  // Set form values when editing
  useEffect(() => {
    if (initialData) {
      const trade = initialData;
      
      // Check if this is likely a lot-based quantity for NIFTY or SENSEX
      const symbol = trade.symbol.toUpperCase();
      const lotSize = getLotSize(symbol);
      const isLotBased = (symbol === 'NIFTY' || symbol === 'SENSEX') && 
                          trade.quantity && (trade.quantity % lotSize === 0);
      
      // Note: Trade uses lot-based quantity calculation
      
      // Format dates properly for the datetime-local inputs
      const formatDateForInput = (dateValue: string | null | undefined) => {
        if (!dateValue) return '';
        // Make sure we have a proper ISO string (YYYY-MM-DDTHH:MM)
        return new Date(dateValue).toISOString().slice(0, 16);
      };

      // Format decimal values to always have 2 decimal places
      const formatDecimal = (value: number | null | undefined): number => {
        if (value === null || value === undefined) return 0;
        return parseFloat(value.toFixed(2));
      };

      // Set form values - basic fields
      setValue('symbol', trade.symbol);
      setValue('type', trade.type);
      setValue('instrumentType', trade.instrumentType || InstrumentType.STOCK);
      setValue('entryPrice', formatDecimal(trade.entryPrice));
      setValue('exitPrice', trade.exitPrice ? formatDecimal(trade.exitPrice) : null);
      setValue('quantity', trade.quantity);
      setValue('entryDate', formatDateForInput(trade.entryDate));
      setValue('exitDate', formatDateForInput(trade.exitDate));
      setValue('profitLoss', trade.profitLoss ? formatDecimal(trade.profitLoss) : null);
      setValue('notes', trade.notes || '');
      setValue('sector', trade.sector || '');
      
      // Set options/futures specific fields
      if (trade.instrumentType === InstrumentType.OPTIONS) {
        setValue('strikePrice', trade.strikePrice ? formatDecimal(trade.strikePrice) : null);
        setValue('expiryDate', formatDateForInput(trade.expiryDate));
        setValue('optionType', trade.optionType || null);
      } else if (trade.instrumentType === InstrumentType.FUTURES) {
        setValue('expiryDate', formatDateForInput(trade.expiryDate));
      }
      
      // Set advanced trade journal fields
      setValue('strategy', trade.strategy || '');
      setValue('timeFrame', trade.timeFrame || '');
      setValue('marketCondition', trade.marketCondition || '');
      setValue('stopLoss', trade.stopLoss ? formatDecimal(trade.stopLoss) : null);
      setValue('targetPrice', trade.targetPrice ? formatDecimal(trade.targetPrice) : null);
      setValue('riskRewardRatio', trade.riskRewardRatio ? formatDecimal(trade.riskRewardRatio) : null);
      setValue('preTradeEmotion', trade.preTradeEmotion || '');
      setValue('postTradeEmotion', trade.postTradeEmotion || '');
      setValue('tradeConfidence', trade.tradeConfidence || null);
      setValue('tradeRating', trade.tradeRating || null);
      setValue('lessons', trade.lessons || '');
      setValue('setupImageUrl', trade.setupImageUrl || '');
      
      setSelectedInstrumentType(trade.instrumentType || InstrumentType.STOCK);
    }
  }, [initialData, setValue]);

  const handleFormSubmit = async (data: TradeFormData) => {
    try {
      console.log('Form data being submitted:', data);
      console.log('Initial data ID:', initialData?.id);
      
      // Additional client-side validation
      if (data.entryPrice <= 0) {
        throw new Error('Entry price must be greater than 0');
      }
      
      if (data.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }
      
      if (data.exitPrice && data.exitPrice <= 0) {
        throw new Error('Exit price must be greater than 0 if provided');
      }
      
      if (data.exitDate && data.entryDate && new Date(data.exitDate) < new Date(data.entryDate)) {
        throw new Error('Exit date cannot be before entry date');
      }
      
      if (initialData?.id !== undefined) {
        console.log('Updating trade with ID:', initialData.id);
        await updateTrade(initialData.id, data);
        console.log('Update successful');
        // Show success toast
        const successEvent = new CustomEvent('showToast', {
          detail: {
            message: 'Trade updated successfully!',
            type: 'success'
          }
        });
        window.dispatchEvent(successEvent);
      } else {
        console.log('Creating new trade');
        await createTrade(data);
        console.log('Create successful');
        // Show success toast
        const successEvent = new CustomEvent('showToast', {
          detail: {
            message: 'Trade created successfully!',
            type: 'success'
          }
        });
        window.dispatchEvent(successEvent);
      }
      onSuccess();
    } catch (error) {
      console.error('Error submitting form:', error);
      // Show error message in a more user-friendly way
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      // Create and dispatch a custom event for error handling
      const errorEvent = new CustomEvent('showToast', {
        detail: {
          message: `Failed to ${initialData?.id !== undefined ? 'update' : 'create'} trade: ${errorMessage}`,
          type: 'error'
        }
      });
      window.dispatchEvent(errorEvent);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 rounded-2xl p-8 shadow-lg border border-white/20">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
        {/* Basic Trade Information */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
          <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-6 flex items-center">
            📊 Basic Trade Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Symbol */}
            <div>
              <label htmlFor="symbol" className="block text-sm font-semibold text-gray-700 mb-2">Symbol *</label>
              <input
                type="text"
                id="symbol"
                {...register('symbol')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="e.g., NIFTY, RELIANCE"
              />
              {errors.symbol && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.symbol.message}</p>}
            </div>

            {/* Trade Type */}
            <div>
              <label htmlFor="type" className="block text-sm font-semibold text-gray-700 mb-2">Trade Type *</label>
              <select
                id="type"
                {...register('type')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
              >
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
              {errors.type && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.type.message}</p>}
            </div>

            {/* Instrument Type */}
            <div>
              <label htmlFor="instrumentType" className="block text-sm font-semibold text-gray-700 mb-2">Instrument Type *</label>
              <select
                id="instrumentType"
                {...register('instrumentType')}
                onChange={(e) => setSelectedInstrumentType(e.target.value)}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
              >
                <option value="STOCK">STOCK</option>
                <option value="FUTURES">FUTURES</option>
                <option value="OPTIONS">OPTIONS</option>
              </select>
              {errors.instrumentType && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.instrumentType.message}</p>}
            </div>
          </div>
        </div>

        {/* Price & Quantity Information */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
          <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-6 flex items-center">
            💰 Price & Quantity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Entry Price */}
            <div>
              <label htmlFor="entryPrice" className="block text-sm font-semibold text-gray-700 mb-2">Entry Price *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                id="entryPrice"
                {...register('entryPrice', { 
                  valueAsNumber: true,
                  onChange: (e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      const formattedValue = parseFloat(value.toFixed(2));
                      if (formattedValue !== value) {
                        setValue('entryPrice', formattedValue);
                      }
                    }
                  }
                })}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="0.00"
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    e.target.value = value.toFixed(2);
                    setValue('entryPrice', parseFloat(value.toFixed(2)));
                  }
                }}
              />
              {errors.entryPrice && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.entryPrice.message}</p>}
            </div>

            {/* Exit Price */}
            <div>
              <label htmlFor="exitPrice" className="block text-sm font-semibold text-gray-700 mb-2">Exit Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                id="exitPrice"
                {...register('exitPrice', { 
                  valueAsNumber: true,
                  onChange: (e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      const formattedValue = parseFloat(value.toFixed(2));
                      if (formattedValue !== value) {
                        setValue('exitPrice', formattedValue);
                      }
                    }
                  } 
                })}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="0.00"
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    e.target.value = value.toFixed(2);
                    setValue('exitPrice', parseFloat(value.toFixed(2)));
                  }
                }}
              />
              {errors.exitPrice && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.exitPrice.message}</p>}
            </div>

            {/* Quantity */}
            <div>
              <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700 mb-2">Quantity *</label>
              <input
                type="number"
                step="1"
                id="quantity"
                {...register('quantity', { valueAsNumber: true })}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="0"
              />
              {errors.quantity && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.quantity.message}</p>}
            </div>
          </div>
        </div>

        {/* Date & Time Information */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
          <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-6 flex items-center">
            📅 Date & Time
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Entry Date */}
            <div>
              <label htmlFor="entryDate" className="block text-sm font-semibold text-gray-700 mb-2">Entry Date & Time *</label>
              <input
                type="datetime-local"
                id="entryDate"
                {...register('entryDate')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
              />
              {errors.entryDate && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.entryDate.message}</p>}
            </div>

            {/* Exit Date */}
            <div>
              <label htmlFor="exitDate" className="block text-sm font-semibold text-gray-700 mb-2">Exit Date & Time</label>
              <input
                type="datetime-local"
                id="exitDate"
                {...register('exitDate')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
              />
              {errors.exitDate && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.exitDate.message}</p>}
            </div>

            {/* Sector */}
            <div>
              <label htmlFor="sector" className="block text-sm font-semibold text-gray-700 mb-2">Sector</label>
              <input
                type="text"
                id="sector"
                {...register('sector')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="e.g., Technology, Banking"
              />
              {errors.sector && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.sector.message}</p>}
            </div>
          </div>
        </div>

        {/* Options/Futures specific fields */}
        {selectedInstrumentType === 'OPTIONS' && (
          <>
            {/* Strike Price */}
            <div>
              <label htmlFor="strikePrice" className="block text-sm font-semibold text-gray-700 mb-2">Strike Price *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                id="strikePrice"
                {...register('strikePrice', { 
                  valueAsNumber: true,
                  onChange: (e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      const formattedValue = parseFloat(value.toFixed(2));
                      if (formattedValue !== value) {
                        setValue('strikePrice', formattedValue);
                      }
                    }
                  }
                })}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="0.00"
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    e.target.value = value.toFixed(2);
                    setValue('strikePrice', parseFloat(value.toFixed(2)));
                  }
                }}
              />
              {errors.strikePrice && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.strikePrice.message}</p>}
            </div>

            {/* Option Type */}
            <div>
              <label htmlFor="optionType" className="block text-sm font-semibold text-gray-700 mb-2">Option Type *</label>
              <select
                id="optionType"
                {...register('optionType')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
              >
                <option value="CALL">CALL</option>
                <option value="PUT">PUT</option>
              </select>
              {errors.optionType && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.optionType.message}</p>}
            </div>

            {/* Expiry Date */}
            <div>
              <label htmlFor="expiryDate" className="block text-sm font-semibold text-gray-700 mb-2">Expiry Date *</label>
              <input
                type="date"
                id="expiryDate"
                {...register('expiryDate')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
              />
              {errors.expiryDate && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.expiryDate.message}</p>}
            </div>
          </>
        )}

        {selectedInstrumentType === 'FUTURES' && (
          <div>
            <label htmlFor="expiryDate" className="block text-sm font-semibold text-gray-700 mb-2">Expiry Date *</label>
            <input
              type="date"
              id="expiryDate"
              {...register('expiryDate')}
              className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
            />
            {errors.expiryDate && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.expiryDate.message}</p>}
          </div>
        )}

        {/* Advanced Trade Analysis */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
          <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-6 flex items-center">
            🧠 Advanced Trade Journal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Strategy */}
            <div>
              <label htmlFor="strategy" className="block text-sm font-semibold text-gray-700 mb-2">Strategy</label>
              <input
                type="text"
                id="strategy"
                {...register('strategy')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="e.g., Breakout, Mean Reversion"
              />
            </div>

            {/* Time Frame */}
            <div>
              <label htmlFor="timeFrame" className="block text-sm font-semibold text-gray-700 mb-2">Time Frame</label>
              <select
                id="timeFrame"
                {...register('timeFrame')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
              >
                {TIME_FRAMES.map(tf => <option key={tf.value} value={tf.value}>{tf.label}</option>)}
              </select>
            </div>

            {/* Market Condition */}
            <div>
              <label htmlFor="marketCondition" className="block text-sm font-semibold text-gray-700 mb-2">Market Condition</label>
              <select
                id="marketCondition"
                {...register('marketCondition')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
              >
                {MARKET_CONDITIONS.map(mc => <option key={mc.value} value={mc.value}>{mc.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Trade Confidence */}
            <div>
              <label htmlFor="tradeConfidence" className="block text-sm font-semibold text-gray-700 mb-2">Trade Confidence (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                id="tradeConfidence"
                {...register('tradeConfidence', { valueAsNumber: true })}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="1-10"
              />
            </div>

            {/* Stop Loss */}
            <div>
              <label htmlFor="stopLoss" className="block text-sm font-semibold text-gray-700 mb-2">Stop Loss</label>
              <input
                type="number"
                step="0.01"
                min="0"
                id="stopLoss"
                {...register('stopLoss', { 
                  valueAsNumber: true,
                  onChange: (e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      const formattedValue = parseFloat(value.toFixed(2));
                      if (formattedValue !== value) {
                        setValue('stopLoss', formattedValue);
                      }
                    }
                  }
                })}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="0.00"
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    e.target.value = value.toFixed(2);
                    setValue('stopLoss', parseFloat(value.toFixed(2)));
                  }
                }}
              />
            </div>

            {/* Target Price */}
            <div>
              <label htmlFor="targetPrice" className="block text-sm font-semibold text-gray-700 mb-2">Target Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                id="targetPrice"
                {...register('targetPrice', { 
                  valueAsNumber: true,
                  onChange: (e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      const formattedValue = parseFloat(value.toFixed(2));
                      if (formattedValue !== value) {
                        setValue('targetPrice', formattedValue);
                      }
                    }
                  }
                })}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="0.00"
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    e.target.value = value.toFixed(2);
                    setValue('targetPrice', parseFloat(value.toFixed(2)));
                  }
                }}
              />
            </div>

            {/* Risk-Reward Ratio */}
            <div>
              <label htmlFor="riskRewardRatio" className="block text-sm font-semibold text-gray-700 mb-2">Risk-Reward Ratio</label>
              <input
                type="number"
                step="0.01"
                min="0"
                id="riskRewardRatio"
                {...register('riskRewardRatio', { 
                  valueAsNumber: true,
                  onChange: (e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      const formattedValue = parseFloat(value.toFixed(2));
                      if (formattedValue !== value) {
                        setValue('riskRewardRatio', formattedValue);
                      }
                    }
                  }
                })}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="0.00"
                readOnly
              />
            </div>

            {/* Pre-Trade Emotion */}
            <div>
              <label htmlFor="preTradeEmotion" className="block text-sm font-semibold text-gray-700 mb-2">Pre-Trade Emotion</label>
              <select
                id="preTradeEmotion"
                {...register('preTradeEmotion')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
              >
                <option value="">Select Emotion</option>
                {PRE_TRADE_EMOTIONS.map(emotion => (
                  <option key={emotion.value} value={emotion.value}>{emotion.label}</option>
                ))}
              </select>
            </div>

            {/* Post-Trade Emotion */}
            <div>
              <label htmlFor="postTradeEmotion" className="block text-sm font-semibold text-gray-700 mb-2">Post-Trade Emotion</label>
              <select
                id="postTradeEmotion"
                {...register('postTradeEmotion')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
              >
                <option value="">Select Emotion</option>
                {POST_TRADE_EMOTIONS.map(emotion => (
                  <option key={emotion.value} value={emotion.value}>{emotion.label}</option>
                ))}
              </select>
            </div>

            {/* Trade Rating */}
            <div>
              <label htmlFor="tradeRating" className="block text-sm font-semibold text-gray-700 mb-2">Trade Rating (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                id="tradeRating"
                {...register('tradeRating', { valueAsNumber: true })}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="1-10"
              />
            </div>

            {/* Setup Image URL */}
            <div>
              <label htmlFor="setupImageUrl" className="block text-sm font-semibold text-gray-700 mb-2">Setup Image URL</label>
              <input
                type="url"
                id="setupImageUrl"
                {...register('setupImageUrl')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
        </div>

        {/* Notes and Lessons */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
          <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-6 flex items-center">
            📝 Notes & Lessons
          </h3>
          <div className="grid grid-cols-1 gap-6">
            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-2">Trade Notes</label>
              <textarea
                id="notes"
                rows={3}
                {...register('notes')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="Any notes about the trade..."
              ></textarea>
            </div>

            {/* Lessons */}
            <div>
              <label htmlFor="lessons" className="block text-sm font-semibold text-gray-700 mb-2">Lessons Learned</label>
              <textarea
                id="lessons"
                rows={3}
                {...register('lessons')}
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white/90 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 hover:shadow-md"
                placeholder="What did you learn from this trade?"
              ></textarea>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 font-medium hover:bg-white hover:shadow-lg transition-all duration-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              `${initialData?.id !== undefined ? '✏️ Update Trade' : '✨ Add Trade'}`
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 