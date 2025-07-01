'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Trade } from '../../types/Trade';
import TradeModal from '../../components/TradeModal';
import { generateTradePDF } from '../../lib/pdfExport';

export default function TradeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  useEffect(() => {
    const fetchTrade = async () => {
      try {
        const response = await fetch(`/api/trades/${params.id}`);
        if (response.ok) {
          const result = await response.json();
          // Handle the API response format that includes success and data fields
          const data = result.data || result;
          setTrade(data);
        } else {
          console.error('Trade not found');
        }
      } catch (error) {
        console.error('Error fetching trade:', error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchTrade();
    }
  }, [params.id]);

  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
      }).format(0);
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00';
    }
    return value.toFixed(2);
  };

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'No date';
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTradeDuration = (entryDate: string | Date | null | undefined, exitDate: string | Date | null | undefined) => {
    if (!entryDate) return 'No entry date';
    if (!exitDate) return 'Position still open';
    
    const entry = typeof entryDate === 'string' ? new Date(entryDate) : entryDate;
    const exit = typeof exitDate === 'string' ? new Date(exitDate) : exitDate;
    
    if (isNaN(entry.getTime()) || isNaN(exit.getTime())) return 'Invalid dates';
    
    const diffTime = Math.abs(exit.getTime() - entry.getTime());
    
    // Calculate different time units
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Handle intraday trades (less than 24 hours)
    if (diffDays === 0) {
      if (diffHours === 0) {
        if (diffMinutes === 0) return 'Less than 1 minute';
        if (diffMinutes === 1) return '1 minute';
        return `${diffMinutes} minutes`;
      }
      if (diffHours === 1) {
        const remainingMinutes = diffMinutes % 60;
        if (remainingMinutes === 0) return '1 hour';
        return `1 hour ${remainingMinutes} min${remainingMinutes !== 1 ? 's' : ''}`;
      }
      const remainingMinutes = diffMinutes % 60;
      if (remainingMinutes === 0) return `${diffHours} hours`;
      return `${diffHours} hours ${remainingMinutes} min${remainingMinutes !== 1 ? 's' : ''}`;
    }
    
    // Handle multi-day trades
    if (diffDays === 1) return '1 day';
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      const remainingDays = diffDays % 7;
      if (weeks === 1 && remainingDays === 0) return '1 week';
      if (remainingDays === 0) return `${weeks} weeks`;
      return `${weeks}w ${remainingDays}d`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      const remainingDays = diffDays % 30;
      if (months === 1 && remainingDays === 0) return '1 month';
      if (remainingDays === 0) return `${months} months`;
      return `${months}m ${Math.floor(remainingDays)}d`;
    }
    
    const years = Math.floor(diffDays / 365);
    const remainingDays = diffDays % 365;
    if (years === 1 && remainingDays === 0) return '1 year';
    if (remainingDays === 0) return `${years} years`;
    return `${years}y ${Math.floor(remainingDays / 30)}m`;
  };

  const getTradeTypeIcon = (instrumentType: string) => {
    switch (instrumentType?.toLowerCase()) {
      case 'stock': return '📈';
      case 'options': return '🔧';
      case 'futures': return '⚡';
      default: return '💼';
    }
  };

  const getPositionTypeColor = (type: string) => {
    return type?.toLowerCase() === 'long' 
      ? 'text-green-600 bg-green-100' 
      : 'text-red-600 bg-red-100';
  };

  const getStatusColor = (exitDate: string | Date | null | undefined) => {
    if (!exitDate) return 'text-yellow-600 bg-yellow-100'; // Open position
    return 'text-blue-600 bg-blue-100'; // Closed position
  };

  const getProfitLossColor = (profitLoss: number) => {
    if (profitLoss > 0) return 'text-green-600';
    if (profitLoss < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const handleTradeUpdate = () => {
    // Refresh the trade data after update
    const fetchTrade = async () => {
      try {
        const response = await fetch(`/api/trades/${params.id}`);
        if (response.ok) {
          const result = await response.json();
          // Handle the API response format that includes success and data fields
          const data = result.data || result;
          setTrade(data);
        }
      } catch (error) {
        console.error('Error fetching trade:', error);
      }
    };
    fetchTrade();
    setIsEditModalOpen(false);
  };

  const handleExportPDF = async () => {
    if (!trade || !session?.user) return;
    
    setIsExportingPDF(true);
    try {
      const userInfo = {
        name: session.user.name || 'Trading User',
        email: session.user.email || 'user@example.com'
      };
      
      await generateTradePDF(trade, userInfo);
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Show error message in a more user-friendly way
      const errorEvent = new CustomEvent('showToast', {
        detail: {
          message: 'Failed to generate PDF. Please try again.',
          type: 'error'
        }
      });
      window.dispatchEvent(errorEvent);
    } finally {
      setIsExportingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-600 mt-4 text-center">Loading trade details...</p>
        </div>
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Trade Not Found</h2>
          <p className="text-gray-600 mb-6">The trade you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => router.push('/trades')}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Back to Trades
          </button>
        </div>
      </div>
    );
  }

  const tradeDuration = calculateTradeDuration(trade.entryDate, trade.exitDate);
  const isProfit = (trade.profitLoss || 0) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-xl bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl hover:bg-white/90 transition-all duration-300"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
                  📊 Trade Details
                </h1>
                <p className="text-gray-600 mt-1">Complete information about this trade</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleExportPDF}
                disabled={isExportingPDF}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExportingPDF ? (
                  <>
                    <div className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>📄 Export PDF</>
                )}
              </button>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                ✏️ Edit Trade
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Trade Information */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Trade Overview Card */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 lg:p-8 shadow-lg border border-white/20">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-2xl">{getTradeTypeIcon(trade.instrumentType)}</span>
                  </div>
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">{trade.symbol}</h2>
                    <p className="text-gray-600">{trade.instrumentType?.toUpperCase()} • {trade.strategy || 'No Strategy'}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-3xl font-bold ${getProfitLossColor(trade.profitLoss || 0)}`}>
                    {trade.profitLoss ? formatCurrency(trade.profitLoss) : 'Pending'}
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPositionTypeColor(trade.type)}`}>
                      {trade.type}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(trade.exitDate)}`}>
                      {trade.exitDate ? 'Closed' : 'Open'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trade Duration */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <span className="text-white">⏱️</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Trade Duration</p>
                      <p className="text-lg font-bold text-gray-900">{tradeDuration}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Entry → Exit</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(trade.entryDate)} → {trade.exitDate ? formatDate(trade.exitDate) : 'Open'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Price Information Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                  <p className="text-sm font-medium text-gray-600 mb-1">Entry Price</p>
                  <p className="text-xl font-bold text-green-600">₹{formatNumber(trade.entryPrice)}</p>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-sm font-medium text-gray-600 mb-1">Exit Price</p>
                  <p className="text-xl font-bold text-blue-600">
                    {trade.exitPrice ? `₹${formatNumber(trade.exitPrice)}` : 'Pending'}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 border border-purple-200">
                  <p className="text-sm font-medium text-gray-600 mb-1">Quantity</p>
                  <p className="text-xl font-bold text-purple-600">{trade.quantity}</p>
                </div>
                
                {trade.strikePrice && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                    <p className="text-sm font-medium text-gray-600 mb-1">Strike Price</p>
                    <p className="text-xl font-bold text-amber-600">₹{formatNumber(trade.strikePrice)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Investment Summary */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 lg:p-8 shadow-lg border border-white/20">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                💰 Investment Summary
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Investment</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency((trade.entryPrice || 0) * (trade.quantity || 0))}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-sm font-medium text-gray-600 mb-1">Exit Value</p>
                  <p className="text-xl font-bold text-gray-900">
                    {trade.exitPrice ? formatCurrency((trade.exitPrice || 0) * (trade.quantity || 0)) : 'Pending'}
                  </p>
                </div>
                
                <div className={`rounded-xl p-4 border ${isProfit ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200'}`}>
                  <p className="text-sm font-medium text-gray-600 mb-1">Net P&L</p>
                  <p className={`text-xl font-bold ${getProfitLossColor(trade.profitLoss || 0)}`}>
                    {trade.profitLoss ? formatCurrency(trade.profitLoss) : 'Pending'}
                  </p>
                </div>
              </div>
            </div>

            {/* Chart Photo Section */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 lg:p-8 shadow-lg border border-white/20">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                📊 Chart Analysis
              </h3>
              
                             {trade.setupImageUrl ? (
                 <div className="relative">
                   <img 
                     src={trade.setupImageUrl} 
                     alt={`${trade.symbol} chart analysis`}
                     className="w-full rounded-xl border border-gray-200 shadow-lg"
                   />
                   <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-sm font-medium">
                     {trade.symbol} Chart
                   </div>
                 </div>
               ) : (
                <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
                  <div className="text-6xl mb-4">📈</div>
                  <p className="text-gray-600 font-medium">No chart photo uploaded</p>
                  <p className="text-sm text-gray-500 mt-1">Upload a chart screenshot to better analyze this trade</p>
                </div>
              )}
            </div>

            {/* Notes Section */}
            {trade.notes && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 lg:p-8 shadow-lg border border-white/20">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  📝 Trade Notes
                </h3>
                <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-gray-700 leading-relaxed">{trade.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Trade Analysis */}
          <div className="space-y-6">
            
            {/* Quick Stats */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                📊 Trade Analysis
              </h3>
              
              <div className="space-y-4">
                                 <div className="flex justify-between items-center">
                   <span className="text-sm font-medium text-gray-600">Risk/Reward</span>
                   <span className="text-sm font-bold text-gray-900">
                     {trade.riskRewardRatio ? `1:${formatNumber(trade.riskRewardRatio)}` : 'N/A'}
                   </span>
                 </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Stop Loss</span>
                  <span className="text-sm font-bold text-red-600">
                    {trade.stopLoss ? `₹${formatNumber(trade.stopLoss)}` : 'Not Set'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Target Price</span>
                  <span className="text-sm font-bold text-green-600">
                    {trade.targetPrice ? `₹${formatNumber(trade.targetPrice)}` : 'Not Set'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Market Condition</span>
                  <span className="text-sm font-bold text-blue-600">
                    {trade.marketCondition || 'Not Recorded'}
                  </span>
                </div>
              </div>
            </div>

            {/* Emotions & Psychology */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                🧠 Psychology
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Pre-Trade Emotion</p>
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    {trade.preTradeEmotion || 'Not recorded'}
                  </span>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Post-Trade Emotion</p>
                  <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    {trade.postTradeEmotion || 'Not recorded'}
                  </span>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Confidence Level</p>
                   <div className="flex items-center space-x-2">
                     <div className="flex-1 bg-gray-200 rounded-full h-2">
                       <div 
                         className="bg-gradient-to-r from-indigo-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                         style={{ width: `${(trade.confidenceLevel || trade.tradeConfidence || 0) * 10}%` }}
                       ></div>
                     </div>
                     <span className="text-sm font-bold text-gray-900">
                       {(trade.confidenceLevel || trade.tradeConfidence) ? `${trade.confidenceLevel || trade.tradeConfidence}/10` : 'N/A'}
                     </span>
                   </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Rating</p>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-lg ${((trade.rating || trade.tradeRating || 0) >= star) ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        ⭐
                      </span>
                    ))}
                    <span className="text-sm text-gray-600 ml-2">
                      {(trade.rating || trade.tradeRating) ? `${trade.rating || trade.tradeRating}/5` : 'Not rated'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lessons Learned */}
            {(trade.lessonsLearned || trade.lessons) && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  💡 Lessons Learned
                </h3>
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border border-yellow-200">
                  <p className="text-gray-700 text-sm leading-relaxed">{trade.lessonsLearned || trade.lessons}</p>
                </div>
              </div>
            )}

            {/* Trade Setup */}
            {(trade.setupDescription || trade.notes) && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  🎯 Trade Setup
                </h3>
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-200">
                  <p className="text-gray-700 text-sm leading-relaxed">{trade.setupDescription || 'See notes section for setup details'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Trade Modal */}
      <TradeModal
        isOpen={isEditModalOpen}
        onClose={handleTradeUpdate}
        title="Edit Trade"
        initialData={trade ? {
          symbol: trade.symbol,
          instrumentType: trade.instrumentType,
          type: trade.type,
          strategy: trade.strategy || undefined,
          entryDate: typeof trade.entryDate === 'string' ? trade.entryDate : trade.entryDate?.toISOString().split('T')[0] || '',
          exitDate: trade.exitDate ? (typeof trade.exitDate === 'string' ? trade.exitDate : trade.exitDate.toISOString().split('T')[0]) : undefined,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice || undefined,
          quantity: trade.quantity,
          strikePrice: trade.strikePrice || undefined,
          expiryDate: trade.expiryDate ? (typeof trade.expiryDate === 'string' ? trade.expiryDate : trade.expiryDate.toISOString().split('T')[0]) : undefined,
          optionType: trade.optionType || undefined,
          premium: trade.premium || undefined,
          profitLoss: trade.profitLoss || undefined,
          riskRewardRatio: trade.riskRewardRatio || undefined,
          stopLoss: trade.stopLoss || undefined,
          targetPrice: trade.targetPrice || undefined,
          timeFrame: trade.timeFrame || undefined,
          marketCondition: trade.marketCondition || undefined,
          preTradeEmotion: trade.preTradeEmotion || undefined,
          postTradeEmotion: trade.postTradeEmotion || undefined,
          tradeConfidence: trade.tradeConfidence || trade.confidenceLevel || undefined,
          tradeRating: trade.tradeRating || trade.rating || undefined,
          notes: trade.notes || undefined,
          lessons: trade.lessons || trade.lessonsLearned || undefined,
          setupImageUrl: trade.setupImageUrl || undefined,
          sector: trade.sector || undefined,
          ...(trade.id && { id: trade.id })
        } : undefined}
      />
    </div>
  );
} 