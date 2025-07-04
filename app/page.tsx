'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  Filler,
} from 'chart.js';
import { Trade } from './types/Trade';
import Image from "next/image";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Color constants for chart
const POSITIVE_COLOR = 'rgb(22, 163, 74)'; // Green
const NEGATIVE_COLOR = 'rgb(220, 38, 38)'; // Red
const POSITIVE_BG_COLOR = 'rgba(22, 163, 74, 0.1)';
const NEGATIVE_BG_COLOR = 'rgba(220, 38, 38, 0.1)';

export default function HomePage() {
  const { data: session, status } = useSession();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [equityCurveData, setEquityCurveData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: [
      {
        label: 'Equity Curve',
        data: [],
        borderColor: POSITIVE_COLOR,
        backgroundColor: POSITIVE_BG_COLOR,
        tension: 0.3,
        fill: true,
      },
    ],
  });

  useEffect(() => {
    // Simpler approach - set loading to false after initial render
    // This prevents infinite loading when session status is stuck
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    if (status === 'authenticated') {
      clearTimeout(timer);
      const fetchTrades = async () => {
        try {
          const response = await fetch('/api/trades');
          if (response.ok) {
            const result = await response.json();
            const tradesData = result.data || [];
            setTrades(tradesData);
            if (tradesData.length > 0) {
              generateEquityCurve(tradesData);
            }
          }
        } catch (error) {
          console.error('Error fetching trades:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchTrades();
    } else if (status === 'unauthenticated') {
      clearTimeout(timer);
      setLoading(false);
    }

    return () => clearTimeout(timer);
  }, [status]);

  const generateEquityCurve = (tradesData: Trade[]) => {
    // Sort trades by entry date
    const sortedTrades = [...tradesData].sort((a, b) => 
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    
    // Generate equity curve data
    let runningTotal = 0;
    const equityPoints = sortedTrades
      .filter(trade => trade.profitLoss !== null && trade.profitLoss !== undefined)
      .map(trade => {
        runningTotal += (trade.profitLoss || 0);
        return {
          date: new Date(trade.entryDate).toLocaleDateString(),
          equity: runningTotal
        };
      });
    
    // Group by date for the chart
    const equityByDate = equityPoints.reduce((acc: Record<string, number>, point) => {
      acc[point.date] = point.equity;
      return acc;
    }, {});
    
    const chartLabels = Object.keys(equityByDate);
    const chartData = Object.values(equityByDate) as number[];
    
    setEquityCurveData({
      labels: chartLabels,
      datasets: [
        {
          label: 'Equity Curve',
          data: chartData,
          segment: {
            borderColor: ctx => chartData[ctx.p1DataIndex] >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR,
            backgroundColor: ctx => chartData[ctx.p1DataIndex] >= 0 ? POSITIVE_BG_COLOR : NEGATIVE_BG_COLOR
          },
          tension: 0.3,
          fill: true,
        },
      ],
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-4 animate-spin">
            <div className="w-8 h-8 bg-white rounded-full"></div>
          </div>
          <p className="text-gray-600 font-medium">Loading your trading dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="container mx-auto px-6 py-16">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl lg:text-6xl font-bold leading-[1.8] pt-8 pb-12 mb-8 flex items-center justify-center gap-4 overflow-visible">
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-slate-300/10 via-blue-400/15 to-indigo-500/20 backdrop-blur-sm rounded-2xl border border-white/20 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Image src="/logo.png" alt="TradingTrac logo" width={40} height={40} className="w-10 h-10 lg:w-12 lg:h-12" />
              </div>
              <span className="font-inter font-bold tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent overflow-visible py-2">TradingTrac</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Professional trading analytics platform to track, analyze, and optimize your trading performance
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signin"
                className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-semibold rounded-2xl hover:from-indigo-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-105"
              >
                Sign In to Continue
              </Link>
              <Link
                href="/signup"
                className="px-8 py-4 bg-white/80 backdrop-blur-sm text-gray-700 font-semibold rounded-2xl border border-white/50 hover:bg-white/90 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Create Account
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {[
              {
                icon: "📈",
                title: "Performance Analytics",
                description: "Track your P&L, win rate, and risk metrics with advanced analytics"
              },
              {
                icon: "📊",
                title: "Trade Management",
                description: "Log and manage all your trades with detailed entry and exit data"
              },
              {
                icon: "🗓️",
                title: "Calendar View",
                description: "Visualize your trading activity and performance over time"
              },
              {
                icon: "🔥",
                title: "Heatmaps",
                description: "Identify your best and worst performing days and patterns"
              },
              {
                icon: "⚖️",
                title: "Risk Management",
                description: "Monitor and control your risk exposure with advanced tools"
              },
              {
                icon: "📋",
                title: "Trading Plan",
                description: "Create and follow structured trading plans and strategies"
              }
            ].map((feature, index) => (
              <div
                key={feature.title}
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-indigo-50 to-blue-50 rounded-3xl p-12 border border-white/50">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready to Optimize Your Trading?
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto">
              Join thousands of traders who use our platform to analyze and improve their trading performance
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-semibold rounded-2xl hover:from-indigo-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-105"
            >
              Get Started Free
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalTrades = trades.length;
  const completedTrades = trades.filter(trade => trade.exitDate && trade.profitLoss !== null);
  const openTrades = trades.filter(trade => !trade.exitDate || trade.profitLoss === null);
  const winningTrades = completedTrades.filter(trade => trade.profitLoss! > 0);
  const losingTrades = completedTrades.filter(trade => trade.profitLoss! < 0);
  
  const totalPnL = completedTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
  const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, trade) => sum + trade.profitLoss!, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, trade) => sum + trade.profitLoss!, 0) / losingTrades.length : 0;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const quickStats = [
    {
      title: "Total P&L",
      value: formatCurrency(totalPnL),
      icon: "💲",
      gradient: totalPnL >= 0 ? "from-green-400 to-emerald-600" : "from-red-400 to-pink-600",
      bgGradient: totalPnL >= 0 ? "from-green-50 to-emerald-50" : "from-red-50 to-pink-50",
      change: totalPnL >= 0 ? "+12.5%" : "-5.2%",
      changeColor: totalPnL >= 0 ? "text-green-600" : "text-red-600"
    },
    {
      title: "Win Rate",
      value: `${winRate.toFixed(1)}%`,
      icon: "🏹",
      gradient: "from-blue-400 to-indigo-600",
      bgGradient: "from-blue-50 to-indigo-50",
      change: "+2.1%",
      changeColor: "text-blue-600"
    },
    {
      title: "Total Trades",
      value: totalTrades.toString(),
      icon: "📊",
      gradient: "from-purple-400 to-violet-600",
      bgGradient: "from-purple-50 to-violet-50",
      change: `+${totalTrades}`,
      changeColor: "text-purple-600"
    },
    {
      title: "Open Positions",
      value: openTrades.length.toString(),
      icon: "🔄",
      gradient: "from-amber-400 to-orange-600",
      bgGradient: "from-amber-50 to-orange-50",
      change: openTrades.length > 0 ? "Active" : "None",
      changeColor: "text-amber-600"
    }
  ];

  const performanceMetrics = [
    {
      title: "Average Win",
      value: formatCurrency(avgWin),
      icon: "📈",
      color: "text-green-600",
      bg: "bg-green-100",
      border: "border-green-200"
    },
    {
      title: "Average Loss",
      value: formatCurrency(Math.abs(avgLoss)),
      icon: "📉",
      color: "text-red-600",
      bg: "bg-red-100",
      border: "border-red-200"
    },
    {
      title: "Risk/Reward",
      value: avgLoss !== 0 ? (avgWin / Math.abs(avgLoss)).toFixed(2) : "N/A",
      icon: "⚖️",
      color: "text-blue-600",
      bg: "bg-blue-100",
      border: "border-blue-200"
    },
    {
      title: "Best Trade",
      value: winningTrades.length > 0 ? formatCurrency(Math.max(...winningTrades.map(t => t.profitLoss!))) : "N/A",
      icon: "🏆",
      color: "text-yellow-600",
      bg: "bg-yellow-100",
      border: "border-yellow-200"
    }
  ];

  const recentTrades = trades.slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
                📊 Trading Dashboard
              </h1>
              <p className="text-gray-600 mt-2">Your trading performance at a glance</p>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Last updated</p>
                <p className="text-sm font-medium text-gray-700">{new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {quickStats.map((stat, index) => (
            <div
              key={stat.title}
              className={`bg-gradient-to-br ${stat.bgGradient} rounded-2xl p-6 border border-white/50 shadow-lg backdrop-blur-sm hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 animate-fade-in-up`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
                  <p className={`text-xs font-medium ${stat.changeColor}`}>
                    {stat.change}
                  </p>
                </div>
                <div className={`text-3xl bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Equity Curve Chart */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            📈 Equity Curve
          </h2>
          {trades.length > 0 ? (
            <div className="h-80">
              <Line 
                data={equityCurveData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: false,
                      grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)',
                      },
                      ticks: {
                        callback: value => '₹' + Number(value).toLocaleString('en-IN')
                      }
                    },
                    x: {
                      grid: {
                        display: false,
                      }
                    }
                  },
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      callbacks: {
                        label: context => '₹' + context.parsed.y.toLocaleString('en-IN')
                      }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-gray-500 text-lg">No trade data available</p>
              <p className="text-sm text-gray-400 mt-1">Start trading to see your equity curve</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Performance Metrics */}
          <div className="lg:col-span-2">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                📈 Performance Metrics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {performanceMetrics.map((metric, index) => (
                  <div
                    key={metric.title}
                    className={`${metric.bg} ${metric.border} border rounded-xl p-4 hover:shadow-md transition-all duration-200 animate-fade-in-up`}
                    style={{ animationDelay: `${(index + 4) * 100}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">{metric.title}</p>
                        <p className={`text-lg font-bold ${metric.color}`}>{metric.value}</p>
                      </div>
                      <span className="text-2xl">{metric.icon}</span>
                    </div>
                  </div>
                ))}
                
                {/* Current Streak */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Current Streak</p>
                      <p className={`text-lg font-bold ${
                        trades.filter(t => t.profitLoss && t.profitLoss > 0).length > trades.filter(t => t.profitLoss && t.profitLoss < 0).length 
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {trades.length > 0 ? (
                          trades.filter(t => t.profitLoss && t.profitLoss > 0).length > trades.filter(t => t.profitLoss && t.profitLoss < 0).length 
                            ? `${trades.slice(-5).filter(t => t.profitLoss && t.profitLoss > 0).length}W` 
                            : `${trades.slice(-5).filter(t => t.profitLoss && t.profitLoss < 0).length}L`
                        ) : '0'}
                      </p>
                    </div>
                    <span className="text-2xl">🔥</span>
                  </div>
                </div>

                {/* Risk Level */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Risk Level</p>
                      <p className="text-lg font-bold text-yellow-600">Medium</p>
                    </div>
                    <span className="text-2xl">⚠️</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Trades */}
          <div className="lg:col-span-1">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                🕒 Recent Trades
              </h2>
                            <div className="space-y-3">
                {recentTrades.length > 0 ? recentTrades.map((trade, index) => (
                  <a
                    key={trade.id || index}
                    href={`/trades/${trade.id}`}
                    className={`block p-3 rounded-lg border transition-all duration-200 hover:shadow-md animate-fade-in-up cursor-pointer ${
                      trade.profitLoss !== null && trade.profitLoss !== undefined && trade.profitLoss > 0
                        ? 'bg-green-50 border-green-200 hover:bg-green-100'
                        : trade.profitLoss !== null && trade.profitLoss !== undefined && trade.profitLoss < 0
                        ? 'bg-red-50 border-red-200 hover:bg-red-100'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    style={{ animationDelay: `${(index + 8) * 100}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{trade.symbol}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        trade.type === 'LONG' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {trade.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {new Date(trade.entryDate).toLocaleDateString()}
                      </span>
                                           {trade.profitLoss !== null && trade.profitLoss !== undefined ? (
                       <span className={`font-semibold ${
                         trade.profitLoss > 0 ? 'text-green-600' : 'text-red-600'
                       }`}>
                         {trade.profitLoss > 0 ? '+' : ''}₹{Math.abs(trade.profitLoss).toFixed(2)}
                       </span>
                     ) : (
                       <span className="text-gray-500 text-xs">Open</span>
                     )}
                    </div>
                  </a>
                )) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">📭</div>
                    <p className="text-gray-500">No trades yet</p>
                    <p className="text-sm text-gray-400 mt-1">Start trading to see your data here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            ⚡ Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/trades"
              className="group bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl p-4 hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">View All Trades</h3>
                  <p className="text-sm text-blue-100">Manage your trades</p>
                </div>
                <span className="text-2xl group-hover:scale-110 transition-transform duration-200">📈</span>
              </div>
            </a>
            <a
              href="/analytics"
              className="group bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl p-4 hover:from-purple-600 hover:to-violet-700 transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Analytics</h3>
                  <p className="text-sm text-purple-100">Deep dive into data</p>
                </div>
                <span className="text-2xl group-hover:scale-110 transition-transform duration-200">📊</span>
              </div>
            </a>
            <a
              href="/trading-plan"
              className="group bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-4 hover:from-green-600 hover:to-emerald-700 transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Trading Plan</h3>
                  <p className="text-sm text-green-100">Strategy & rules</p>
                </div>
                <span className="text-2xl group-hover:scale-110 transition-transform duration-200">🎯</span>
              </div>
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}