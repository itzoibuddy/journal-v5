'use client';

import { useState, useEffect, useMemo } from 'react';
import { Trade } from '@/app/types/Trade';
import { format, parseISO, getDay, getHours, startOfWeek, addDays, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';

// Market hours configuration for different markets
const MARKET_HOURS = {
  indian: {
    name: 'Indian Markets',
    hours: [9, 10, 11, 12, 13, 14, 15], // 9:00 AM to 3:00 PM (main session)
    extendedHours: [16, 17, 18, 19, 20, 21], // 4:00 PM to 9:00 PM (after-market)
    commodityHours: [22, 23], // 10:00 PM to 11:00 PM (commodity extended)
    allHours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] // All trading hours
  },
  global: {
    name: 'Global Markets (24/7)',
    hours: Array.from({ length: 24 }, (_, i) => i), // All 24 hours
    allHours: Array.from({ length: 24 }, (_, i) => i)
  }
};

// Enhanced color scale for better visual impact
const getHeatmapColor = (value: number, max: number, min: number, type: 'pnl' | 'winrate' | 'volume' = 'pnl') => {
  if (value === 0 || (max === 0 && min === 0)) return 'rgb(243, 244, 246)'; // gray-100
  
  const normalized = Math.abs(max - min) > 0 ? (value - min) / (max - min) : 0;
  
  switch (type) {
    case 'pnl':
      if (value > 0) {
        const intensity = Math.min(normalized * 0.9 + 0.1, 1);
        return `rgba(34, 197, 94, ${intensity})`; // green
      } else {
        const intensity = Math.min(Math.abs(normalized) * 0.9 + 0.1, 1);
        return `rgba(239, 68, 68, ${intensity})`; // red
      }
    case 'winrate':
      const intensity = Math.min(normalized * 0.8 + 0.2, 1);
      return `rgba(59, 130, 246, ${intensity})`; // blue
    case 'volume':
      const volIntensity = Math.min(normalized * 0.8 + 0.2, 1);
      return `rgba(168, 85, 247, ${volIntensity})`; // purple
    default:
      return 'rgb(243, 244, 246)';
  }
};

export default function HeatmapsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<string>('month');
  const [selectedHeatmap, setSelectedHeatmap] = useState<string>('hourly');
  const [marketType, setMarketType] = useState<'indian' | 'global'>('indian');

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch('/api/trades');
        if (!response.ok) throw new Error('Failed to fetch trades');
        const result = await response.json();
        const data = result.data || [];
        setTrades(data);
      } catch (error) {
        console.error('Error fetching trades:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTrades();
  }, []);

  // Filter trades based on timeframe
  const filteredTrades = useMemo(() => {
    if (timeframe === 'all') return trades;
    const now = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case 'week': startDate.setDate(now.getDate() - 7); break;
      case 'month': startDate.setMonth(now.getMonth() - 1); break;
      case 'quarter': startDate.setMonth(now.getMonth() - 3); break;
      case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
      default: return trades;
    }

    return trades.filter(trade => new Date(trade.entryDate) >= startDate);
  }, [trades, timeframe]);

  // Hourly Performance Heatmap - filtered by market hours
  const hourlyData = useMemo(() => {
    const selectedMarket = MARKET_HOURS[marketType];
    const relevantHours = selectedMarket.allHours;
    
    const hours = relevantHours.map(hour => ({
      hour,
      trades: 0,
      profitLoss: 0,
      winRate: 0,
      wins: 0,
    }));

    filteredTrades.forEach(trade => {
      const hour = getHours(new Date(trade.entryDate));
      const hourIndex = relevantHours.indexOf(hour);
      
      if (hourIndex !== -1) {
        hours[hourIndex].trades += 1;
        hours[hourIndex].profitLoss += trade.profitLoss || 0;
        if ((trade.profitLoss || 0) > 0) {
          hours[hourIndex].wins += 1;
        }
      }
    });

    hours.forEach(hour => {
      hour.winRate = hour.trades > 0 ? (hour.wins / hour.trades) * 100 : 0;
    });

    return hours;
  }, [filteredTrades, marketType]);

  // Day-Hour Matrix Heatmap - filtered by market hours
  const dayHourMatrix = useMemo(() => {
    const selectedMarket = MARKET_HOURS[marketType];
    const relevantHours = selectedMarket.allHours;
    const matrix: any[][] = [];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let day = 0; day < 7; day++) {
      matrix[day] = [];
      for (let i = 0; i < relevantHours.length; i++) {
        const hour = relevantHours[i];
        matrix[day][i] = {
          day: days[day],
          hour,
          trades: 0,
          profitLoss: 0,
          winRate: 0,
          wins: 0,
        };
      }
    }

    filteredTrades.forEach(trade => {
      const date = new Date(trade.entryDate);
      const day = getDay(date);
      const hour = getHours(date);
      const hourIndex = relevantHours.indexOf(hour);
      
      if (hourIndex !== -1) {
        matrix[day][hourIndex].trades += 1;
        matrix[day][hourIndex].profitLoss += trade.profitLoss || 0;
        if ((trade.profitLoss || 0) > 0) {
          matrix[day][hourIndex].wins += 1;
        }
      }
    });

    // Calculate win rates
    matrix.forEach(dayRow => {
      dayRow.forEach(cell => {
        cell.winRate = cell.trades > 0 ? (cell.wins / cell.trades) * 100 : 0;
      });
    });

    return { matrix, relevantHours };
  }, [filteredTrades, marketType]);

  // Monthly Calendar Heatmap
  const monthlyCalendar = useMemo(() => {
    if (filteredTrades.length === 0) return [];
    
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const days = eachDayOfInterval({ start, end });
    
    const calendarData = days.map(day => {
      const dayTrades = filteredTrades.filter(trade => 
        format(new Date(trade.entryDate), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );
      
      const profitLoss = dayTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
      const wins = dayTrades.filter(trade => (trade.profitLoss || 0) > 0).length;
      
      return {
        date: day,
        trades: dayTrades.length,
        profitLoss,
        winRate: dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0,
        dayOfWeek: getDay(day),
      };
    });

    return calendarData;
  }, [filteredTrades]);

  // Strategy Performance Matrix
  const strategyMatrix = useMemo(() => {
    const strategies = [...new Set(filteredTrades.map(t => t.strategy || 'No Strategy'))];
    const timeSlots = marketType === 'indian' 
      ? ['Market Open (9-12)', 'Midday (12-15)', 'Market Close (15-18)', 'After Hours (18-23)']
      : ['Early Morning (0-6)', 'Morning (6-12)', 'Afternoon (12-18)', 'Evening (18-24)'];
    
    const matrix = strategies.map(strategy => {
      return timeSlots.map(slot => {
        let start: number, end: number;
        
        if (marketType === 'indian') {
          if (slot.includes('9-12')) [start, end] = [9, 12];
          else if (slot.includes('12-15')) [start, end] = [12, 15];
          else if (slot.includes('15-18')) [start, end] = [15, 18];
          else [start, end] = [18, 24]; // After hours
        } else {
          if (slot.includes('0-6')) [start, end] = [0, 6];
          else if (slot.includes('6-12')) [start, end] = [6, 12];
          else if (slot.includes('12-18')) [start, end] = [12, 18];
          else [start, end] = [18, 24];
        }
        
        const slotTrades = filteredTrades.filter(trade => {
          const hour = getHours(new Date(trade.entryDate));
          return (trade.strategy || 'No Strategy') === strategy && hour >= start && hour < end;
        });
        
        const profitLoss = slotTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
        const wins = slotTrades.filter(trade => (trade.profitLoss || 0) > 0).length;
        
        return {
          strategy,
          timeSlot: slot,
          trades: slotTrades.length,
          profitLoss,
          winRate: slotTrades.length > 0 ? (wins / slotTrades.length) * 100 : 0,
          avgReturn: slotTrades.length > 0 ? profitLoss / slotTrades.length : 0,
        };
      });
    });

    return { strategies, timeSlots, matrix };
  }, [filteredTrades, marketType]);

  // Risk-Adjusted Performance
  const riskAdjustedData = useMemo(() => {
    const sizeBuckets = [
      { name: 'Small', min: 0, max: 10000 },
      { name: 'Medium', min: 10000, max: 50000 },
      { name: 'Large', min: 50000, max: 100000 },
      { name: 'XLarge', min: 100000, max: Infinity }
    ];

    return sizeBuckets.map(bucket => {
      const bucketTrades = filteredTrades.filter(trade => {
        const size = trade.quantity * trade.entryPrice;
        return size >= bucket.min && size < bucket.max;
      });

      const profitLoss = bucketTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
      const wins = bucketTrades.filter(trade => (trade.profitLoss || 0) > 0).length;
      const avgSize = bucketTrades.length > 0 ? 
        bucketTrades.reduce((sum, trade) => sum + (trade.quantity * trade.entryPrice), 0) / bucketTrades.length : 0;

      return {
        ...bucket,
        trades: bucketTrades.length,
        profitLoss,
        winRate: bucketTrades.length > 0 ? (wins / bucketTrades.length) * 100 : 0,
        avgReturn: bucketTrades.length > 0 ? profitLoss / bucketTrades.length : 0,
        returnPerRisk: avgSize > 0 ? (profitLoss / avgSize) * 100 : 0,
      };
    }).filter(bucket => bucket.trades > 0);
  }, [filteredTrades]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading advanced heatmaps...</p>
        </div>
      </div>
    );
  }

  const getMinMax = (data: any[], key: string) => {
    const values = data.map(item => item[key]).filter(v => typeof v === 'number');
    return { min: Math.min(...values, 0), max: Math.max(...values, 0) };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg">
                  🔥
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Advanced Trading Heatmaps</h1>
                  <p className="text-sm text-gray-600">Discover your optimal trading patterns and performance insights</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="quarter">Past Quarter</option>
                <option value="year">Past Year</option>
                <option value="all">All Time</option>
              </select>
              
              <select
                value={selectedHeatmap}
                onChange={(e) => setSelectedHeatmap(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="hourly">Hourly Performance</option>
                <option value="matrix">Day-Hour Matrix</option>
                <option value="calendar">Monthly Calendar</option>
                <option value="strategy">Strategy Performance</option>
                <option value="risk">Risk-Adjusted</option>
              </select>
              
              <select
                value={marketType}
                onChange={(e) => setMarketType(e.target.value as 'indian' | 'global')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="indian">Indian Market Hours (9 AM - 11 PM)</option>
                <option value="global">Global Markets (24/7)</option>
              </select>
            </div>
            
            <div className="text-sm text-gray-600">
              📊 {filteredTrades.length} trades analyzed
            </div>
          </div>
        </div>

        {/* Hourly Performance Heatmap */}
        {selectedHeatmap === 'hourly' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">📈 Hourly Trading Performance</h3>
            <p className="text-gray-600 mb-6">
              Discover your most profitable trading hours
              {marketType === 'indian' && (
                <span className="block text-sm text-blue-600 mt-1">
                  Showing Indian market hours: Regular Session (9 AM - 3 PM), After Hours (4 PM - 11 PM)
                </span>
              )}
            </p>
            
            <div className="grid grid-cols-8 lg:grid-cols-12 gap-2 mb-6">
              {hourlyData.map((hour, index) => {
                const { min, max } = getMinMax(hourlyData, 'profitLoss');
                return (
                  <div
                    key={index}
                    className="aspect-square rounded-lg border border-gray-200 flex flex-col items-center justify-center text-xs font-medium cursor-pointer hover:scale-105 transition-transform"
                    style={{ backgroundColor: getHeatmapColor(hour.profitLoss, max, min, 'pnl') }}
                    title={`${hour.hour}:00 - ${hour.trades} trades, ₹${hour.profitLoss.toLocaleString('en-IN')}, ${hour.winRate.toFixed(1)}% win rate`}
                  >
                    <div className="text-gray-800">{hour.hour}:00</div>
                    <div className="text-xs text-gray-600">{hour.trades}</div>
                  </div>
                );
              })}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(() => {
                const bestHour = hourlyData.reduce((best, current) => 
                  current.profitLoss > best.profitLoss ? current : best
                );
                const worstHour = hourlyData.reduce((worst, current) => 
                  current.profitLoss < worst.profitLoss ? current : worst
                );
                const mostActiveHour = hourlyData.reduce((most, current) => 
                  current.trades > most.trades ? current : most
                );

                return (
                  <>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-800">🌟 Best Hour</h4>
                      <div className="text-2xl font-bold text-green-700">{bestHour.hour}:00</div>
                      <div className="text-sm text-green-600">₹{bestHour.profitLoss.toLocaleString('en-IN')} • {bestHour.winRate.toFixed(1)}%</div>
                    </div>
                    
                    <div className="bg-red-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-red-800">⚠️ Worst Hour</h4>
                      <div className="text-2xl font-bold text-red-700">{worstHour.hour}:00</div>
                      <div className="text-sm text-red-600">₹{worstHour.profitLoss.toLocaleString('en-IN')} • {worstHour.winRate.toFixed(1)}%</div>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-800">🚀 Most Active</h4>
                      <div className="text-2xl font-bold text-blue-700">{mostActiveHour.hour}:00</div>
                      <div className="text-sm text-blue-600">{mostActiveHour.trades} trades • {mostActiveHour.winRate.toFixed(1)}%</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Day-Hour Matrix */}
        {selectedHeatmap === 'matrix' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">🗓️ Day-Hour Performance Matrix</h3>
            <p className="text-gray-600 mb-6">Find your optimal trading windows across the week</p>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-sm font-medium text-gray-600">Day</th>
                    {dayHourMatrix.relevantHours.map((hour, index) => (
                      <th key={index} className="text-center p-1 text-xs text-gray-500">{hour}:00</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dayHourMatrix.matrix.map((dayRow, dayIndex) => {
                    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex];
                    const allCells = dayHourMatrix.matrix.flat();
                    const { min, max } = getMinMax(allCells, 'profitLoss');
                    
                    return (
                      <tr key={dayIndex}>
                        <td className="p-2 text-sm font-medium text-gray-700">{dayName}</td>
                        {dayRow.map((cell, hourIndex) => (
                          <td key={hourIndex} className="p-1">
                            <div
                              className="w-6 h-6 rounded border border-gray-200 cursor-pointer hover:scale-125 transition-transform"
                              style={{ backgroundColor: getHeatmapColor(cell.profitLoss, max, min, 'pnl') }}
                              title={`${dayName} ${dayHourMatrix.relevantHours[hourIndex]}:00 - ${cell.trades} trades, ₹${cell.profitLoss.toLocaleString('en-IN')}`}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Loss</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-100 rounded"></div>
                <span>No Trades</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>Profit</span>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Calendar */}
        {selectedHeatmap === 'calendar' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">📅 Monthly Performance Calendar</h3>
            <p className="text-gray-600 mb-6">Visual overview of daily trading performance</p>
            
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">{day}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {monthlyCalendar.map((day, index) => {
                const { min, max } = getMinMax(monthlyCalendar, 'profitLoss');
                return (
                  <div
                    key={index}
                    className="aspect-square rounded-lg border border-gray-200 p-2 hover:scale-105 transition-transform cursor-pointer"
                    style={{ backgroundColor: getHeatmapColor(day.profitLoss, max, min, 'pnl') }}
                    title={`${format(day.date, 'MMM d')} - ${day.trades} trades, ₹${day.profitLoss.toLocaleString('en-IN')}`}
                  >
                    <div className="text-xs font-medium text-gray-800">{format(day.date, 'd')}</div>
                    {day.trades > 0 && (
                      <div className="text-xs text-gray-600 mt-1">{day.trades}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Strategy Performance Matrix */}
        {selectedHeatmap === 'strategy' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">⚡ Strategy Performance Matrix</h3>
            <p className="text-gray-600 mb-6">Compare strategy effectiveness across different time periods</p>
            
            {strategyMatrix.strategies.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Strategy</th>
                      {strategyMatrix.timeSlots.map((slot, index) => (
                        <th key={index} className="text-center p-3 text-sm font-medium text-gray-600">{slot}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategyMatrix.matrix.map((strategyRow, strategyIndex) => {
                      const allCells = strategyMatrix.matrix.flat();
                      const { min, max } = getMinMax(allCells, 'profitLoss');
                      
                      return (
                        <tr key={strategyIndex}>
                          <td className="p-3 text-sm font-medium text-gray-700">
                            {strategyMatrix.strategies[strategyIndex]}
                          </td>
                          {strategyRow.map((cell, slotIndex) => (
                            <td key={slotIndex} className="p-3 text-center">
                              <div
                                className="rounded-lg p-3 border border-gray-200 hover:scale-105 transition-transform cursor-pointer"
                                style={{ backgroundColor: getHeatmapColor(cell.profitLoss, max, min, 'pnl') }}
                                title={`${cell.strategy} - ${cell.timeSlot}: ₹${cell.profitLoss.toLocaleString('en-IN')}, ${cell.winRate.toFixed(1)}% win rate`}
                              >
                                <div className="text-sm font-medium text-gray-800">₹{cell.profitLoss.toLocaleString('en-IN')}</div>
                                <div className="text-xs text-gray-600">{cell.trades} trades</div>
                                <div className="text-xs text-gray-600">{cell.winRate.toFixed(1)}%</div>
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">📊</div>
                <p>No strategy data available</p>
                <p className="text-sm mt-2">Add strategy information to your trades to see this analysis</p>
              </div>
            )}
          </div>
        )}

        {/* Risk-Adjusted Performance */}
        {selectedHeatmap === 'risk' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">🎯 Risk-Adjusted Performance</h3>
            <p className="text-gray-600 mb-6">Analyze performance relative to position size and risk</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {riskAdjustedData.map((bucket, index) => {
                const { min, max } = getMinMax(riskAdjustedData, 'returnPerRisk');
                return (
                  <div
                    key={index}
                    className="p-6 rounded-xl border border-gray-200 hover:scale-105 transition-transform cursor-pointer"
                    style={{ backgroundColor: getHeatmapColor(bucket.returnPerRisk, max, min, 'pnl') }}
                  >
                    <h4 className="font-bold text-gray-800 mb-2">{bucket.name} Positions</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Trades:</span>
                        <span className="font-medium">{bucket.trades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total P&L:</span>
                        <span className={`font-medium ${bucket.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₹{bucket.profitLoss.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Win Rate:</span>
                        <span className="font-medium">{bucket.winRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Return/Risk:</span>
                        <span className={`font-bold ${bucket.returnPerRisk >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {bucket.returnPerRisk.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Key Insights */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">💡 Key Trading Insights</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Best Trading Time */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">🌟 Optimal Trading Window</h4>
              {(() => {
                const bestCell = dayHourMatrix.matrix.flat().reduce((best, current) => 
                  current.profitLoss > best.profitLoss ? current : best
                );
                return (
                  <div>
                    <div className="text-lg font-bold text-green-700">
                      {bestCell.day} at {bestCell.hour}:00
                    </div>
                    <div className="text-sm text-green-600 mt-1">
                      ₹{bestCell.profitLoss.toLocaleString('en-IN')} • {bestCell.winRate.toFixed(1)}% win rate
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Consistency Score */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">📊 Consistency Score</h4>
              {(() => {
                const profitableDays = monthlyCalendar.filter(day => day.profitLoss > 0).length;
                const tradingDays = monthlyCalendar.filter(day => day.trades > 0).length;
                const consistency = tradingDays > 0 ? (profitableDays / tradingDays) * 100 : 0;
                return (
                  <div>
                    <div className="text-lg font-bold text-blue-700">{consistency.toFixed(1)}%</div>
                    <div className="text-sm text-blue-600 mt-1">
                      {profitableDays} profitable out of {tradingDays} trading days
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Risk Efficiency */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-xl border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2">🎯 Risk Efficiency</h4>
              {(() => {
                const bestRiskBucket = riskAdjustedData.reduce((best, current) => 
                  current.returnPerRisk > best.returnPerRisk ? current : best, 
                  { name: 'N/A', returnPerRisk: 0 }
                );
                return (
                  <div>
                    <div className="text-lg font-bold text-purple-700">{bestRiskBucket.name}</div>
                    <div className="text-sm text-purple-600 mt-1">
                      {bestRiskBucket.returnPerRisk.toFixed(2)}% return per risk unit
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 