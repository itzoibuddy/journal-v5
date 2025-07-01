'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import LoadingSpinner from '../components/LoadingSpinner';
import TradingMindsetCoach from '../components/TradingMindsetCoach';
import { AdvancedInsights, generateMarketSentiment } from '../lib/advanced-ai-analytics';

interface AdvancedInsightData {
  success: boolean;
  data: {
    totalTrades: number;
    totalPnL: number;
    winRate: number;
    performanceAnalysis: any;
    behavioralAnalysis: any;
    patternRecognition: any;
    predictiveInsights: any;
    aiCoaching: any;
    marketSentiment: any;
    topPerformingSetups: any[];
    monthlyPerformance: any[];
    trends: any;
    riskLevel: string;
    performanceGrade: any;
    priorityActions: any[];
    emotionalState: any;
    analysisReliability: string;
  };
}

// Simple replica of server getPerformanceGrade logic (keep in sync)
function computePerformanceScore(data: any): number {
  const weights = {
    sharpeRatio: 0.25,
    profitFactor: 0.20,
    consistency: 0.20,
    maxDrawdown: 0.15,
    winLossRatio: 0.10,
    disciplineScore: 0.08,
    overtradingRisk: 0.06,
    revengeTradingRisk: 0.06,
  };
  const p = data.performanceAnalysis;
  const b = data.behavioralAnalysis;
  const sharpeScore = Math.min(100, Math.max(0, (p.sharpeRatio + 2) * 25));
  const profitScore = Math.min(100, Math.max(0, (p.profitFactor - 0.5) * 50));
  const consistencyScore = p.consistency;
  const drawdownScore = Math.max(0, 100 - p.maxDrawdown * 2);
  const winLossScore = Math.min(100, p.winLossRatio * 50);
  const disciplineScore = b.disciplineScore;
  const overtradingScore = 100 - (b.overtradingRisk || 0);
  const revengeScore = 100 - (b.revengeTradingRisk || 0);

  const overall =
    sharpeScore * weights.sharpeRatio +
    profitScore * weights.profitFactor +
    consistencyScore * weights.consistency +
    drawdownScore * weights.maxDrawdown +
    winLossScore * weights.winLossRatio +
    disciplineScore * weights.disciplineScore +
    overtradingScore * weights.overtradingRisk +
    revengeScore * weights.revengeTradingRisk;

  return Math.round(overall);
}

export default function AIInsights() {
  const { data: session, status } = useSession();
  const [insights, setInsights] = useState<AdvancedInsightData | null>(null);
  const [basicInsights, setBasicInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'advanced' | 'basic'>('advanced');

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAdvancedInsights();
    }
  }, [status]);

  const fetchAdvancedInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try advanced insights first
      const advancedResponse = await fetch('/api/insights/advanced');
      
      if (advancedResponse.ok) {
        const advancedData = await advancedResponse.json();
        setInsights(advancedData);
        setViewMode('advanced');
      } else {
        // Fall back to basic insights
        const basicResponse = await fetch('/api/insights/quick');
        if (basicResponse.ok) {
          const basicData = await basicResponse.json();
          setBasicInsights(basicData);
          setViewMode('basic');
        } else {
          throw new Error('Failed to fetch insights');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return <LoadingSpinner />;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">AI Insights</h1>
          <p className="text-gray-600">Please sign in to view your trading insights.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">AI Insights</h1>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={fetchAdvancedInsights}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === 'basic' && !basicInsights) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">AI Insights</h1>
          <p className="text-gray-600">No trading data available for analysis.</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'advanced' && !insights) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Advanced AI Insights</h1>
          <p className="text-gray-600">Need at least 5 completed trades for advanced analysis.</p>
        </div>
      </div>
    );
  }

  const data = viewMode === 'advanced' ? insights?.data : basicInsights;
  if (!data) return null;

  // Advanced AI insights view
  if (viewMode === 'advanced' && insights?.data) {
    const { data: advancedData } = insights;
    
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🧠 Advanced AI Trading Insights</h1>
          <p className="text-gray-600">Sophisticated analytics powered by machine learning</p>
          <div className="mt-4 flex justify-center space-x-4">
            <span className={`px-3 py-1 rounded-full text-sm ${
              advancedData.analysisReliability === 'High' ? 'bg-green-100 text-green-800' :
              advancedData.analysisReliability === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {advancedData.analysisReliability} Reliability
            </span>
            <span className={`px-3 py-1 rounded-full text-sm ${
              advancedData.riskLevel === 'Low' ? 'bg-green-100 text-green-800' :
              advancedData.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {advancedData.riskLevel} Risk
            </span>
          </div>
        </div>

        {/* Performance Grade */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 border border-white/50">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Overall Performance Grade</h2>
            <div className="flex items-center justify-center space-x-6">
              <div className={`text-6xl font-bold ${
                advancedData.performanceGrade.grade.startsWith('A') ? 'text-green-600' :
                advancedData.performanceGrade.grade.startsWith('B') ? 'text-blue-600' :
                advancedData.performanceGrade.grade.startsWith('C') ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {advancedData.performanceGrade.grade}
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{advancedData.performanceGrade.score}/100</div>
                <div className="text-sm text-gray-600">{advancedData.performanceGrade.description}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Core Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total P&L</p>
                <p className={`text-2xl font-bold ${advancedData.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{advancedData.totalPnL.toLocaleString()}
                </p>
              </div>
              <span className="text-3xl">💰</span>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Win Rate</p>
                <p className="text-2xl font-bold text-blue-600">{advancedData.winRate.toFixed(1)}%</p>
              </div>
              <span className="text-3xl">🎯</span>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sharpe Ratio</p>
                <p className="text-2xl font-bold text-purple-600">{advancedData.performanceAnalysis.sharpeRatio}</p>
              </div>
              <span className="text-3xl">📊</span>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Max Drawdown</p>
                <p className="text-2xl font-bold text-red-600">{advancedData.performanceAnalysis.maxDrawdown.toFixed(1)}%</p>
              </div>
              <span className="text-3xl">📉</span>
            </div>
          </div>
        </div>

        {/* Priority Actions */}
        {advancedData.priorityActions.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-red-800 mb-4 flex items-center">
              🚨 Priority Actions Required
            </h2>
            <div className="space-y-3">
              {advancedData.priorityActions.map((action: any, index: number) => (
                <div key={index} className={`p-4 rounded-lg ${
                  action.priority === 'Critical' ? 'bg-red-100 border border-red-300' :
                  action.priority === 'High' ? 'bg-orange-100 border border-orange-300' :
                  'bg-yellow-100 border border-yellow-300'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          action.priority === 'Critical' ? 'bg-red-600 text-white' :
                          action.priority === 'High' ? 'bg-orange-600 text-white' :
                          'bg-yellow-600 text-white'
                        }`}>
                          {action.priority}
                        </span>
                        <span className="text-sm text-gray-600">{action.impact}</span>
                      </div>
                      <h4 className="font-semibold text-gray-900">{action.action}</h4>
                      <p className="text-sm text-gray-700 mt-1">{action.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Coaching */}
        <TradingMindsetCoach 
          insights={{
            performanceAnalysis: advancedData.performanceAnalysis,
            behavioralAnalysis: advancedData.behavioralAnalysis,
            patternRecognition: advancedData.patternRecognition,
            predictiveInsights: advancedData.predictiveInsights,
            aiCoaching: advancedData.aiCoaching
          }}
        />

        {/* Market Sentiment */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            🎭 Market Sentiment Analysis
          </h2>
          <div className="text-center mb-4">
            <div className={`inline-block px-4 py-2 rounded-full text-lg font-semibold ${
              advancedData.marketSentiment.sentiment === 'Bullish' ? 'bg-green-100 text-green-800' :
              advancedData.marketSentiment.sentiment === 'Bearish' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {advancedData.marketSentiment.sentiment}
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {advancedData.marketSentiment.confidence}% Confidence
            </div>
          </div>
          <div className="space-y-2">
            {advancedData.marketSentiment.reasoning.map((reason: string, index: number) => (
              <div key={index} className="flex items-start text-sm text-gray-600">
                <span className="text-blue-500 mr-2 mt-1">•</span>
                {reason}
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
            <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Advanced Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Profit Factor:</span>
                <span className="font-semibold">{advancedData.performanceAnalysis.profitFactor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Calmar Ratio:</span>
                <span className="font-semibold">{advancedData.performanceAnalysis.calmarRatio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Consistency:</span>
                <span className="font-semibold">{advancedData.performanceAnalysis.consistency.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Win/Loss Ratio:</span>
                <span className="font-semibold">{advancedData.performanceAnalysis.winLossRatio}:1</span>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
            <h3 className="text-lg font-bold text-gray-900 mb-4">🧠 Behavioral Analysis</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Discipline Score:</span>
                <span className="font-semibold">{advancedData.behavioralAnalysis.disciplineScore.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Risk Tolerance:</span>
                <span className="font-semibold">{advancedData.behavioralAnalysis.riskTolerance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Emotional State:</span>
                <span className={`font-semibold ${
                  advancedData.emotionalState.color === 'green' ? 'text-green-600' :
                  advancedData.emotionalState.color === 'red' ? 'text-red-600' :
                  advancedData.emotionalState.color === 'orange' ? 'text-orange-600' : 'text-blue-600'
                }`}>
                  {advancedData.emotionalState.state}
                </span>
              </div>
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">{advancedData.emotionalState.recommendation}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Predictive Insights */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-white/50">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🔮 Predictive Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {advancedData.predictiveInsights.nextTradeSuccess}%
              </div>
              <div className="text-sm text-gray-600">Next Trade Success</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {advancedData.predictiveInsights.optimalPositionSize}%
              </div>
              <div className="text-sm text-gray-600">Optimal Position Size</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {advancedData.predictiveInsights.suggestedStrategies.length}
              </div>
              <div className="text-sm text-gray-600">Strategy Suggestions</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Basic insights fallback view
  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🧠 AI Trading Insights</h1>
        <p className="text-gray-600">Basic analytics (Complete 5+ trades for advanced insights)</p>
      </div>

      {/* Basic metrics display */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total P&L</p>
              <p className={`text-2xl font-bold ${basicInsights.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{basicInsights.totalPnL.toLocaleString()}
              </p>
            </div>
            <span className="text-3xl">💰</span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Win Rate</p>
              <p className="text-2xl font-bold text-blue-600">{basicInsights.winRate.toFixed(1)}%</p>
            </div>
            <span className="text-3xl">🎯</span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Risk/Reward</p>
              <p className="text-2xl font-bold text-purple-600">{basicInsights.riskReward.toFixed(2)}</p>
            </div>
            <span className="text-3xl">⚖️</span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Trades</p>
              <p className="text-2xl font-bold text-gray-900">{basicInsights.totalTrades}</p>
            </div>
            <span className="text-3xl">📊</span>
          </div>
        </div>
      </div>

      {/* Basic AI Recommendations */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          🧠 AI Recommendations
        </h2>
        <div className="space-y-3">
          {basicInsights.aiRecommendations.map((recommendation: string, index: number) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-blue-500 mt-0.5">💡</span>
              <p className="text-gray-700">{recommendation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 