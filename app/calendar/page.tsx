'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { format, getDaysInMonth, startOfMonth, getDay, addDays, startOfWeek, isToday } from 'date-fns';

interface Trade {
  id: number;
  symbol: string;
  type: string;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  entryDate: string;
  exitDate: string | null;
  profitLoss: number | null;
  notes: string | null;
  setupImageUrl?: string | null;
  strategy?: string | null;
  timeFrame?: string | null;
  marketCondition?: string | null;
  stopLoss?: number | null;
  targetPrice?: number | null;
  riskRewardRatio?: number | null;
  preTradeEmotion?: string | null;
  postTradeEmotion?: string | null;
  tradeConfidence?: number | null;
  tradeRating?: number | null;
  lessons?: string | null;
  instrumentType?: string | null;
  strikePrice?: number | null;
  expiryDate?: string | null;
  optionType?: string | null;
}

function getDayPL(trades: Trade[]) {
  return trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
}

function getDayTradeCount(trades: Trade[]) {
  return trades.length;
}

function formatNumber(num: number): string {
  return Number(num.toFixed(2)).toLocaleString('en-IN');
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Market holidays (you can customize this for your region)
const marketHolidays = [
  '2024-01-26', '2024-03-08', '2024-03-25', '2024-04-14', '2024-05-01',
  '2024-08-15', '2024-10-02', '2024-11-01', '2024-12-25'
];

// Helper functions
function formatDateForComparison(date: Date | string) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return format(date, 'yyyy-MM-dd');
}

function isSameDay(dateA: Date | string, dateB: Date | string) {
  return formatDateForComparison(dateA) === formatDateForComparison(dateB);
}

function getPLColor(pl: number, intensity: number) {
  if (pl > 0) {
    if (intensity > 0.8) return 'bg-green-500 text-white border-green-600';
    if (intensity > 0.6) return 'bg-green-400 text-green-900 border-green-500';
    if (intensity > 0.4) return 'bg-green-300 text-green-800 border-green-400';
    if (intensity > 0.2) return 'bg-green-200 text-green-700 border-green-300';
    return 'bg-green-100 text-green-600 border-green-200';
  } else if (pl < 0) {
    if (intensity > 0.8) return 'bg-red-500 text-white border-red-600';
    if (intensity > 0.6) return 'bg-red-400 text-red-900 border-red-500';
    if (intensity > 0.4) return 'bg-red-300 text-red-800 border-red-400';
    if (intensity > 0.2) return 'bg-red-200 text-red-700 border-red-300';
    return 'bg-red-100 text-red-600 border-red-200';
  }
  return 'bg-white text-gray-700 border-gray-200';
}

function getPLIntensity(pl: number, maxPL: number) {
  if (maxPL === 0) return 0;
  return Math.min(Math.abs(pl) / maxPL, 1);
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [dayTrades, setDayTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyStats, setMonthlyStats] = useState({
    totalPL: 0,
    tradingDays: 0,
    winningDays: 0,
    losingDays: 0,
    totalTrades: 0,
    winStreak: 0,
    lossStreak: 0,
    bestDay: 0,
    worstDay: 0,
    avgDailyPL: 0
  });
  const [weeklyTotals, setWeeklyTotals] = useState<number[]>([0, 0, 0, 0, 0]);
  const [showTradeDetails, setShowTradeDetails] = useState<boolean>(false);
  const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(null);
  const [maxPLInMonth, setMaxPLInMonth] = useState(0);
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');

  useEffect(() => {
    const now = new Date();
    setSelectedDate(now);
    setCurrentMonth(now);
  }, []);

  const year = currentMonth ? currentMonth.getFullYear() : new Date().getFullYear();
  const month = currentMonth ? currentMonth.getMonth() : new Date().getMonth();
  const daysInMonth = currentMonth ? getDaysInMonth(currentMonth) : 30;
  const firstDayOfWeek = currentMonth ? getDay(startOfMonth(currentMonth)) : 0;

  useEffect(() => {
    if (!currentMonth) return;
    
    async function loadTradesForMonth() {
      try {
        setIsLoading(true);
        
        const response = await fetch('/api/trades');
        if (!response.ok) {
          throw new Error('Failed to fetch trades');
        }
        
        const result = await response.json();
        const data = result.data || [];
        setAllTrades(data);
        
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        
        const monthTrades = data.filter((trade: Trade) => {
          const tradeDate = new Date(trade.entryDate);
          return tradeDate >= monthStart && tradeDate <= monthEnd;
        });

        const tradesByDay = new Map<string, Trade[]>();
        monthTrades.forEach((trade: Trade) => {
          const dayStr = formatDateForComparison(trade.entryDate);
          if (!tradesByDay.has(dayStr)) {
            tradesByDay.set(dayStr, []);
          }
          tradesByDay.get(dayStr)!.push(trade);
        });

        let winStreak = 0;
        let lossStreak = 0;
        let currentWinStreak = 0;
        let currentLossStreak = 0;
        let winningDays = 0;
        let losingDays = 0;
        let bestDay = 0;
        let worstDay = 0;
        let maxPL = 0;

        for (const [dayStr, dayTrades] of tradesByDay) {
          const dayPL = getDayPL(dayTrades);
          maxPL = Math.max(maxPL, Math.abs(dayPL));
          
          if (dayPL > 0) {
            winningDays++;
            currentWinStreak++;
            currentLossStreak = 0;
            winStreak = Math.max(winStreak, currentWinStreak);
            bestDay = Math.max(bestDay, dayPL);
          } else if (dayPL < 0) {
            losingDays++;
            currentLossStreak++;
            currentWinStreak = 0;
            lossStreak = Math.max(lossStreak, currentLossStreak);
            worstDay = Math.min(worstDay, dayPL);
          }
        }

        setMaxPLInMonth(maxPL);

        const totalPL = monthTrades.reduce((sum: number, trade: Trade) => sum + (trade.profitLoss || 0), 0);
        const tradingDays = tradesByDay.size;
        const avgDailyPL = tradingDays > 0 ? totalPL / tradingDays : 0;

        setMonthlyStats({
          totalPL,
          tradingDays,
          winningDays,
          losingDays,
          totalTrades: monthTrades.length,
          winStreak,
          lossStreak,
          bestDay,
          worstDay,
          avgDailyPL
        });
        
        const weeklyTotals: number[] = [];
        let currentWeekStart = startOfWeek(new Date(year, month, 1));
        
        for (let weekNum = 0; weekNum < 6; weekNum++) {
          const weekStart = addDays(currentWeekStart, weekNum * 7);
          const weekEnd = addDays(weekStart, 6);
          
          const weekTrades = data.filter((trade: Trade) => {
            const tradeDate = new Date(trade.entryDate);
            return tradeDate >= weekStart && tradeDate <= weekEnd;
          });
          
          const weekTotal = weekTrades.reduce((sum: number, trade: Trade) => sum + (trade.profitLoss || 0), 0);
          weeklyTotals.push(weekTotal);
        }
        
        setWeeklyTotals(weeklyTotals);
        
        if (selectedDate) {
          updateDayTrades(selectedDate, data);
        }
        
      } catch (err) {
        console.error('Error loading trades:', err);
        setError('Failed to load trading data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadTradesForMonth();
  }, [currentMonth, year, month, selectedDate]);

  function updateDayTrades(date: Date, trades: Trade[]) {
    const selectedDayStr = formatDateForComparison(date);
    const filteredTrades = trades.filter(trade => 
      formatDateForComparison(trade.entryDate) === selectedDayStr
    );
    setDayTrades(filteredTrades);
  }

  const days: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleViewTradeDetails = (index: number) => {
    setSelectedTradeIndex(index);
    setShowTradeDetails(true);
  };
  
  const handleCloseTradeDetails = () => {
    setSelectedTradeIndex(null);
    setShowTradeDetails(false);
  };

  const navigateToPreviousMonth = () => {
    if (currentMonth) {
      setCurrentMonth(new Date(year, month - 1, 1));
    }
  };

  const navigateToNextMonth = () => {
    if (currentMonth) {
      setCurrentMonth(new Date(year, month + 1, 1));
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(now);
    setSelectedDate(now);
  };

  if (!selectedDate || !currentMonth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-4 px-4 sm:py-6 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
            📊 Trading Calendar
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">Track your trading performance and identify profitable patterns</p>
        </div>

        {/* View Mode Toggles - Mobile Optimized */}
        <div className="flex justify-center mb-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/60 p-2">
            <div className="flex space-x-1">
              <button
                onClick={() => setViewMode('full')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  viewMode === 'full' 
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Full
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  viewMode === 'compact' 
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Compact
              </button>
              <button
                onClick={goToToday}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all duration-200"
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {/* Monthly Stats - Mobile Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-3 sm:p-4 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Total P&L</p>
                <p className={`text-base sm:text-xl lg:text-2xl font-bold ${monthlyStats.totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {monthlyStats.totalPL >= 0 ? '+' : ''}₹{formatNumber(monthlyStats.totalPL)}
                </p>
                <p className="text-xs text-gray-500">{monthlyStats.totalTrades} trades</p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-100 rounded-full">
                <span className="text-sm sm:text-lg">💰</span>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-3 sm:p-4 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Win Rate</p>
                <p className="text-base sm:text-xl lg:text-2xl font-bold text-blue-600">
                  {monthlyStats.tradingDays > 0 ? Math.round((monthlyStats.winningDays / monthlyStats.tradingDays) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-500">{monthlyStats.winningDays} winning days</p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-100 rounded-full">
                <span className="text-sm sm:text-lg">🎯</span>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-3 sm:p-4 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Best Day</p>
                <p className="text-base sm:text-xl lg:text-2xl font-bold text-green-600">
                  +₹{formatNumber(monthlyStats.bestDay)}
                </p>
                <p className="text-xs text-gray-500">{monthlyStats.winStreak} day streak</p>
              </div>
              <div className="p-2 sm:p-3 bg-green-100 rounded-full">
                <span className="text-sm sm:text-lg">🔥</span>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-3 sm:p-4 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Avg Daily P&L</p>
                <p className={`text-base sm:text-xl lg:text-2xl font-bold ${monthlyStats.avgDailyPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {monthlyStats.avgDailyPL >= 0 ? '+' : ''}₹{formatNumber(monthlyStats.avgDailyPL)}
                </p>
                <p className="text-xs text-gray-500">{monthlyStats.tradingDays} trading days</p>
              </div>
              <div className="p-2 sm:p-3 bg-purple-100 rounded-full">
                <span className="text-sm sm:text-lg">⚡</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="bg-red-100 rounded-full p-2 mr-3">
                  <span className="text-red-600">⚠️</span>
                </div>
                <span className="text-red-800 font-medium">{error}</span>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 transition-colors rounded-full p-1 hover:bg-red-100"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Calendar Navigation */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
            <button
              onClick={navigateToPreviousMonth}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl transition-all duration-200 font-medium hover:shadow-md order-1 sm:order-none min-w-[120px] justify-center"
            >
              <span className="mr-2 text-lg">←</span> Previous
            </button>
            
            <div className="text-center order-0 sm:order-none">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{monthNames[month]} {year}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {monthlyStats.totalTrades} trades • {monthlyStats.tradingDays} trading days
              </p>
            </div>
            
            <button
              onClick={navigateToNextMonth}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl transition-all duration-200 font-medium hover:shadow-md order-2 sm:order-none min-w-[120px] justify-center"
            >
              Next <span className="ml-2 text-lg">→</span>
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading calendar data...</span>
            </div>
          ) : (
            <div className={`grid gap-1 sm:gap-2 ${viewMode === 'compact' ? 'grid-cols-7' : 'grid-cols-8'}`}>
              {/* Day Headers */}
              {(viewMode === 'compact' 
                ? ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
                : ["", "SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
              ).map((d, idx) => (
                <div key={idx} className="text-center py-2 sm:py-3">
                  <span className="text-xs sm:text-sm font-semibold text-gray-600">{d}</span>
                </div>
              ))}
              
              {/* Week numbers and days */}
              {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIdx) => {
                const weekStart = weekIdx * 7;
                const weekDays = days.slice(weekStart, weekStart + 7);
                
                return (
                  <div key={weekIdx} className="contents">
                    {viewMode === 'full' && (
                      /* Week total */
                      <div className="flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 h-16 sm:h-20">
                        <div className="text-center">
                          <div className="text-xs font-medium text-blue-800">W{weekIdx + 1}</div>
                          <div className={`text-xs sm:text-sm font-bold ${
                            weeklyTotals[weekIdx] > 0 ? 'text-green-600' : 
                            weeklyTotals[weekIdx] < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            ₹{formatNumber(Math.abs(weeklyTotals[weekIdx] || 0))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Days in week - Mobile Optimized */}
                    {weekDays.map((date, dayIdx) => {
                      if (!date) {
                        return <div key={`empty-${weekIdx}-${dayIdx}`} className="h-16 sm:h-20" />;
                      }

                      const dayStr = formatDateForComparison(date);
                      const dayTrades = allTrades.filter(trade => 
                        formatDateForComparison(trade.entryDate) === dayStr
                      );
                      
                      const pl = getDayPL(dayTrades);
                      const count = getDayTradeCount(dayTrades);
                      const dayOfWeek = date.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const isHoliday = marketHolidays.includes(dayStr);
                      const isCurrentDay = isToday(date);
                      const isSelected = selectedDate && isSameDay(date, selectedDate);
                      
                      let bgClass = 'bg-white border-gray-200 text-gray-700';
                      
                      if (isHoliday) {
                        bgClass = 'bg-yellow-50 border-yellow-300 text-yellow-700';
                      } else if (isWeekend) {
                        bgClass = 'bg-gray-50 border-gray-200 text-gray-400';
                      } else if (count > 0) {
                        const intensity = getPLIntensity(pl, maxPLInMonth);
                        bgClass = getPLColor(pl, intensity);
                      }
                      
                      if (isSelected) {
                        bgClass += ' ring-2 ring-blue-500 ring-offset-1';
                      }
                      
                      if (isCurrentDay) {
                        bgClass += ' ring-2 ring-indigo-400';
                      }

                      return (
                        <button
                          key={dayIdx}
                          onClick={() => handleDateClick(date)}
                          className={`h-16 sm:h-20 border rounded-lg hover:ring-2 hover:ring-blue-300 hover:shadow-md transition-all duration-200 ${bgClass} flex flex-col items-center justify-center p-1 relative group touch-manipulation overflow-hidden`}
                          title={count > 0 ? `${count} trades • P&L: ₹${formatNumber(pl)}` : ''}
                        >
                          <span className="font-bold text-sm sm:text-base">
                            {date.getDate()}
                          </span>
                          {!isWeekend && !isHoliday && count > 0 && (
                            <>
                              <span className="text-xs sm:text-sm font-medium leading-tight truncate max-w-full px-1">
                                ₹{Math.abs(pl) >= 1000 
                                  ? `${(Math.abs(pl) / 1000).toFixed(1)}k` 
                                  : formatNumber(Math.abs(pl))}
                              </span>
                              {viewMode === 'full' && (
                                <span className="text-xs opacity-75">
                                  {count}
                                </span>
                              )}
                            </>
                          )}
                          {isHoliday && (
                            <span className="text-xs sm:text-sm">🏛️</span>
                          )}
                          {isCurrentDay && (
                            <div className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full"></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Day Details */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : ''}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {dayTrades.length} {dayTrades.length === 1 ? 'trade' : 'trades'} on this day
              </p>
            </div>
            {dayTrades.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6 w-full sm:w-auto">
                <div className="text-left sm:text-right">
                  <p className="text-sm text-gray-600">Day P&L</p>
                  <p className={`text-lg sm:text-xl font-bold ${getDayPL(dayTrades) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {getDayPL(dayTrades) >= 0 ? '+' : ''}₹{formatNumber(getDayPL(dayTrades))}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm text-gray-600">Win Rate</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-600">
                    {Math.round((dayTrades.filter(t => (t.profitLoss || 0) > 0).length / dayTrades.length) * 100)}%
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {dayTrades.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl">📅</span>
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No trades on this day</h4>
                <p className="text-gray-500">
                  {selectedDate && (getDay(selectedDate) === 0 || getDay(selectedDate) === 6) 
                    ? "It's a weekend - markets are closed" 
                    : marketHolidays.includes(formatDateForComparison(selectedDate))
                    ? "Market holiday"
                    : "Select a different day to view trades"}
                </p>
              </div>
            )}
            
            {dayTrades.map((trade, index) => (
              <div key={trade.id} className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-4 hover:shadow-md transition-all duration-200 border border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                      trade.profitLoss && trade.profitLoss > 0 ? 'bg-green-500' : 
                      trade.profitLoss && trade.profitLoss < 0 ? 'bg-red-500' : 'bg-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900 text-lg">{trade.symbol}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          trade.type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {trade.type}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                        <span className="flex items-center">
                          <span className="font-medium">{trade.strategy || 'No Strategy'}</span>
                        </span>
                        <span>•</span>
                        <span>{trade.quantity} shares</span>
                        {trade.timeFrame && (
                          <>
                            <span>•</span>
                            <span>{trade.timeFrame}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 w-full sm:w-auto">
                    <div className="text-right flex-1 sm:flex-none">
                      <p className={`text-lg font-bold ${
                        trade.profitLoss && trade.profitLoss > 0 ? 'text-green-600' : 
                        trade.profitLoss && trade.profitLoss < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {trade.profitLoss ? `${trade.profitLoss > 0 ? '+' : ''}₹${formatNumber(trade.profitLoss)}` : 'Open'}
                      </p>
                      <p className="text-sm text-gray-500">
                        ₹{formatNumber(trade.entryPrice)} → {trade.exitPrice ? `₹${formatNumber(trade.exitPrice)}` : 'Open'}
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => handleViewTradeDetails(index)}
                      className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                    >
                      <span className="mr-2">👁️</span>
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trade Details Modal */}
        {showTradeDetails && selectedTradeIndex !== null && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      {dayTrades[selectedTradeIndex].symbol} Trade Details
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        dayTrades[selectedTradeIndex].type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {dayTrades[selectedTradeIndex].type}
                      </span>
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {format(new Date(dayTrades[selectedTradeIndex].entryDate), 'PPP')}
                    </p>
                  </div>
                  <button
                    onClick={handleCloseTradeDetails}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <span className="text-gray-400 hover:text-gray-600">✕</span>
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* P&L Summary Card */}
                <div className={`rounded-xl p-6 ${
                  dayTrades[selectedTradeIndex].profitLoss && dayTrades[selectedTradeIndex].profitLoss > 0 
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' 
                    : dayTrades[selectedTradeIndex].profitLoss && dayTrades[selectedTradeIndex].profitLoss < 0
                    ? 'bg-gradient-to-r from-red-50 to-pink-50 border border-red-200'
                    : 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Profit & Loss</p>
                      <p className={`text-3xl font-bold ${
                        dayTrades[selectedTradeIndex].profitLoss && dayTrades[selectedTradeIndex].profitLoss > 0 ? 'text-green-600' : 
                        dayTrades[selectedTradeIndex].profitLoss && dayTrades[selectedTradeIndex].profitLoss < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {dayTrades[selectedTradeIndex].profitLoss 
                          ? `${dayTrades[selectedTradeIndex].profitLoss > 0 ? '+' : ''}₹${formatNumber(dayTrades[selectedTradeIndex].profitLoss)}` 
                          : 'Open Position'}
                      </p>
                    </div>
                    <div className={`p-4 rounded-full ${
                      dayTrades[selectedTradeIndex].profitLoss && dayTrades[selectedTradeIndex].profitLoss > 0 ? 'bg-green-100' : 
                      dayTrades[selectedTradeIndex].profitLoss && dayTrades[selectedTradeIndex].profitLoss < 0 ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                      <span className="text-2xl">
                        {dayTrades[selectedTradeIndex].profitLoss && dayTrades[selectedTradeIndex].profitLoss > 0 ? '📈' : 
                         dayTrades[selectedTradeIndex].profitLoss && dayTrades[selectedTradeIndex].profitLoss < 0 ? '📉' : '⏳'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Trade Setup Image */}
                {dayTrades[selectedTradeIndex].setupImageUrl && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Trade Setup</h4>
                    <img 
                      src={dayTrades[selectedTradeIndex].setupImageUrl} 
                      alt="Trade Setup" 
                      className="w-full rounded-lg border border-gray-200 shadow-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/1200x800?text=Image+Not+Found';
                      }}
                    />
                  </div>
                )}
                
                {/* Trade Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-sm text-blue-600 font-medium">Symbol</p>
                    <p className="text-lg font-bold text-blue-900">{dayTrades[selectedTradeIndex].symbol}</p>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-sm text-purple-600 font-medium">Strategy</p>
                    <p className="text-lg font-bold text-purple-900">{dayTrades[selectedTradeIndex].strategy || 'No Strategy'}</p>
                  </div>
                  
                  <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                    <p className="text-sm text-indigo-600 font-medium">Quantity</p>
                    <p className="text-lg font-bold text-indigo-900">{dayTrades[selectedTradeIndex].quantity}</p>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <p className="text-sm text-orange-600 font-medium">Time Frame</p>
                    <p className="text-lg font-bold text-orange-900">{dayTrades[selectedTradeIndex].timeFrame || '-'}</p>
                  </div>
                </div>

                {/* Price Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 text-lg">Price Information</h4>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Entry Price:</span>
                        <span className="font-bold text-gray-900">₹{formatNumber(dayTrades[selectedTradeIndex].entryPrice)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Exit Price:</span>
                        <span className="font-bold text-gray-900">
                          {dayTrades[selectedTradeIndex].exitPrice 
                            ? `₹${formatNumber(dayTrades[selectedTradeIndex].exitPrice)}` 
                            : 'Not closed'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Stop Loss:</span>
                        <span className="font-bold text-gray-900">
                          {dayTrades[selectedTradeIndex].stopLoss 
                            ? `₹${formatNumber(dayTrades[selectedTradeIndex].stopLoss)}` 
                            : 'Not set'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Target Price:</span>
                        <span className="font-bold text-gray-900">
                          {dayTrades[selectedTradeIndex].targetPrice 
                            ? `₹${formatNumber(dayTrades[selectedTradeIndex].targetPrice)}` 
                            : 'Not set'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 text-lg">Trade Analysis</h4>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Risk-Reward:</span>
                        <span className="font-bold text-gray-900">
                          {dayTrades[selectedTradeIndex].riskRewardRatio ? `1:${dayTrades[selectedTradeIndex].riskRewardRatio}` : 'Not calculated'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Confidence:</span>
                        <div className="flex items-center">
                          <span className="font-bold text-gray-900 mr-2">
                            {dayTrades[selectedTradeIndex].tradeConfidence ? `${dayTrades[selectedTradeIndex].tradeConfidence}/10` : 'Not rated'}
                          </span>
                          {dayTrades[selectedTradeIndex].tradeConfidence && (
                            <div className="flex">
                              {Array.from({ length: 5 }, (_, i) => (
                                <span key={i} className={`text-sm ${i < (dayTrades[selectedTradeIndex].tradeConfidence || 0) / 2 ? 'text-yellow-400' : 'text-gray-300'}`}>
                                  ⭐
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Rating:</span>
                        <div className="flex items-center">
                          <span className="font-bold text-gray-900 mr-2">
                            {dayTrades[selectedTradeIndex].tradeRating ? `${dayTrades[selectedTradeIndex].tradeRating}/10` : 'Not rated'}
                          </span>
                          {dayTrades[selectedTradeIndex].tradeRating && (
                            <div className="flex">
                              {Array.from({ length: 5 }, (_, i) => (
                                <span key={i} className={`text-sm ${i < (dayTrades[selectedTradeIndex].tradeRating || 0) / 2 ? 'text-blue-400' : 'text-gray-300'}`}>
                                  ⭐
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Market Condition:</span>
                        <span className="font-bold text-gray-900">{dayTrades[selectedTradeIndex].marketCondition || 'Not specified'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emotions & Psychology */}
                {(dayTrades[selectedTradeIndex].preTradeEmotion || dayTrades[selectedTradeIndex].postTradeEmotion) && (
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="font-semibold text-gray-900 text-lg mb-4">Trading Psychology</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dayTrades[selectedTradeIndex].preTradeEmotion && (
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <h5 className="font-medium text-blue-800 mb-2">Pre-Trade Emotion</h5>
                          <p className="text-blue-700">{dayTrades[selectedTradeIndex].preTradeEmotion}</p>
                        </div>
                      )}
                      {dayTrades[selectedTradeIndex].postTradeEmotion && (
                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                          <h5 className="font-medium text-purple-800 mb-2">Post-Trade Emotion</h5>
                          <p className="text-purple-700">{dayTrades[selectedTradeIndex].postTradeEmotion}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes and Lessons */}
                {(dayTrades[selectedTradeIndex].notes || dayTrades[selectedTradeIndex].lessons) && (
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="font-semibold text-gray-900 text-lg mb-4">Notes & Lessons</h4>
                    <div className="space-y-4">
                      {dayTrades[selectedTradeIndex].notes && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <h5 className="font-medium text-gray-800 mb-2">Trade Notes</h5>
                          <p className="text-gray-700 leading-relaxed">{dayTrades[selectedTradeIndex].notes}</p>
                        </div>
                      )}
                      
                      {dayTrades[selectedTradeIndex].lessons && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                          <h5 className="font-medium text-blue-800 mb-2">Lessons Learned</h5>
                          <p className="text-blue-700 leading-relaxed">{dayTrades[selectedTradeIndex].lessons}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 