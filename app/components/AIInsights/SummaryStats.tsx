'use client';

import { AdvancedInsights } from '../../lib/advanced-ai-analytics';

interface SummaryStatsProps {
  insights: AdvancedInsights;
  marketSentiment: {
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    confidence: number;
    reasoning: string[];
  };
}

export default function SummaryStats({ insights, marketSentiment }: SummaryStatsProps) {
  const getScoreColor = (score: number, reverse = false) => {
    if (reverse) {
      if (score <= 30) return 'text-green-600';
      if (score <= 70) return 'text-yellow-600';
      return 'text-red-600';
    } else {
      if (score >= 70) return 'text-green-600';
      if (score >= 40) return 'text-yellow-600';
      return 'text-red-600';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'Bullish': return 'text-green-600 bg-green-100';
      case 'Bearish': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPerformanceGrade = (score: number) => {
    if (score >= 90) return { grade: 'A+', color: 'text-green-600' };
    if (score >= 80) return { grade: 'A', color: 'text-green-600' };
    if (score >= 70) return { grade: 'B+', color: 'text-blue-600' };
    if (score >= 60) return { grade: 'B', color: 'text-blue-600' };
    if (score >= 50) return { grade: 'C+', color: 'text-yellow-600' };
    if (score >= 40) return { grade: 'C', color: 'text-yellow-600' };
    return { grade: 'D', color: 'text-red-600' };
  };

  const calculateOverallScore = () => {
    const weights = {
      sharpeRatio: 0.25,
      profitFactor: 0.20,
      consistency: 0.20,
      maxDrawdown: 0.15,
      winLossRatio: 0.10,
      disciplineScore: 0.10,
    };

    const sharpeScore = Math.min(100, Math.max(0, (insights.performanceAnalysis.sharpeRatio + 2) * 25));
    const profitScore = Math.min(100, Math.max(0, (insights.performanceAnalysis.profitFactor - 0.5) * 50));
    const consistencyScore = insights.performanceAnalysis.consistency;
    const drawdownScore = Math.max(0, 100 - insights.performanceAnalysis.maxDrawdown * 2);
    const winLossScore = Math.min(100, insights.performanceAnalysis.winLossRatio * 50);
    const disciplineScore = insights.behavioralAnalysis.disciplineScore;

    return Math.round(
      sharpeScore * weights.sharpeRatio +
      profitScore * weights.profitFactor +
      consistencyScore * weights.consistency +
      drawdownScore * weights.maxDrawdown +
      winLossScore * weights.winLossRatio +
      disciplineScore * weights.disciplineScore
    );
  };

  const overallScore = calculateOverallScore();
  const performanceGrade = getPerformanceGrade(overallScore);

  return (
    <div className="space-y-6">
      {/* Overall Performance Score */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 border border-white/50">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">AI Performance Score</h2>
          <div className="flex items-center justify-center space-x-4">
            <div className={`text-6xl font-bold ${performanceGrade.color}`}>
              {performanceGrade.grade}
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${performanceGrade.color}`}>
                {overallScore}/100
              </div>
              <div className="text-sm text-gray-600">Overall Rating</div>
            </div>
          </div>
          <div className="mt-4 text-gray-600">
            {overallScore >= 80 
              ? "Exceptional trading performance! You're in the top tier of traders."
              : overallScore >= 60 
              ? "Solid trading performance with room for improvement."
              : "Focus on risk management and consistency to improve your score."
            }
          </div>
        </div>
      </div>

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sharpe Ratio */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Sharpe Ratio</span>
            <span className="text-xl">📊</span>
          </div>
          <div className={`text-2xl font-bold ${getScoreColor((insights.performanceAnalysis.sharpeRatio + 2) * 25)}`}>
            {insights.performanceAnalysis.sharpeRatio.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {insights.performanceAnalysis.sharpeRatio > 1 
              ? "Excellent risk-adjusted returns"
              : insights.performanceAnalysis.sharpeRatio > 0.5 
              ? "Good risk-adjusted returns"
              : "Improve risk management"
            }
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Max Drawdown</span>
            <span className="text-xl">📉</span>
          </div>
          <div className={`text-2xl font-bold ${getScoreColor(insights.performanceAnalysis.maxDrawdown, true)}`}>
            {insights.performanceAnalysis.maxDrawdown.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {insights.performanceAnalysis.maxDrawdown < 10 
              ? "Excellent risk control"
              : insights.performanceAnalysis.maxDrawdown < 20 
              ? "Good risk control"
              : "High risk - reduce exposure"
            }
          </div>
        </div>

        {/* Profit Factor */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Profit Factor</span>
            <span className="text-xl">💰</span>
          </div>
          <div className={`text-2xl font-bold ${getScoreColor((insights.performanceAnalysis.profitFactor - 0.5) * 50)}`}>
            {insights.performanceAnalysis.profitFactor.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {insights.performanceAnalysis.profitFactor > 1.5 
              ? "Strong profit generation"
              : insights.performanceAnalysis.profitFactor > 1.2 
              ? "Decent profit generation"
              : "Improve win rate or R:R"
            }
          </div>
        </div>

        {/* Consistency */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Consistency</span>
            <span className="text-xl">🎯</span>
          </div>
          <div className={`text-2xl font-bold ${getScoreColor(insights.performanceAnalysis.consistency)}`}>
            {insights.performanceAnalysis.consistency.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {insights.performanceAnalysis.consistency > 70 
              ? "Very consistent"
              : insights.performanceAnalysis.consistency > 50 
              ? "Moderately consistent"
              : "Work on consistency"
            }
          </div>
        </div>
      </div>

      {/* Market Sentiment & Behavioral Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Sentiment */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            🎭 Market Sentiment Analysis
          </h3>
          
          <div className="text-center mb-4">
            <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${getSentimentColor(marketSentiment.sentiment)}`}>
              {marketSentiment.sentiment}
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {marketSentiment.confidence}% Confidence
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Analysis:</h4>
            {marketSentiment.reasoning.map((reason, index) => (
              <div key={index} className="flex items-start text-sm text-gray-600">
                <span className="text-blue-500 mr-2 mt-1">•</span>
                {reason}
              </div>
            ))}
          </div>
        </div>

        {/* Behavioral Metrics */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            🧠 Behavioral Analysis
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Discipline Score</span>
              <div className="flex items-center">
                <div className={`text-lg font-bold ${getScoreColor(insights.behavioralAnalysis.disciplineScore)}`}>
                  {insights.behavioralAnalysis.disciplineScore.toFixed(0)}%
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Overconfidence Risk</span>
              <div className={`text-lg font-bold ${getScoreColor(insights.behavioralAnalysis.overconfidenceScore, true)}`}>
                {insights.behavioralAnalysis.overconfidenceScore.toFixed(0)}%
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Fear/Greed Index</span>
              <div className={`text-lg font-bold ${getScoreColor(insights.behavioralAnalysis.fearGreedIndex, true)}`}>
                {insights.behavioralAnalysis.fearGreedIndex.toFixed(0)}%
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Risk Tolerance</span>
              <div className={`text-lg font-bold ${
                insights.behavioralAnalysis.riskTolerance === 'Conservative' ? 'text-blue-600' :
                insights.behavioralAnalysis.riskTolerance === 'Moderate' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {insights.behavioralAnalysis.riskTolerance}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Predictive Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-white/50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          🔮 AI Predictions & Recommendations
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {insights.predictiveInsights.nextTradeSuccess}%
            </div>
            <div className="text-sm text-gray-600">Next Trade Success</div>
            <div className="text-xs text-gray-500 mt-1">
              {insights.predictiveInsights.marketOutlook}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {insights.predictiveInsights.optimalPositionSize}%
            </div>
            <div className="text-sm text-gray-600">Optimal Position Size</div>
            <div className="text-xs text-gray-500 mt-1">
              Based on Kelly Criterion
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {insights.predictiveInsights.suggestedStrategies.length}
            </div>
            <div className="text-sm text-gray-600">Strategy Suggestions</div>
            <div className="text-xs text-gray-500 mt-1">
              Personalized recommendations
            </div>
          </div>
        </div>

        {/* Risk Warnings */}
        {insights.predictiveInsights.riskWarnings.length > 0 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <h4 className="font-medium text-red-800 mb-2 flex items-center">
              ⚠️ Risk Warnings
            </h4>
            <div className="space-y-1">
              {insights.predictiveInsights.riskWarnings.map((warning, index) => (
                <div key={index} className="text-sm text-red-700">
                  • {warning}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Performance Trends */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          📈 Performance Breakdown
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">
              {insights.performanceAnalysis.winLossRatio.toFixed(2)}:1
            </div>
            <div className="text-sm text-gray-600">Win/Loss Ratio</div>
          </div>
          
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">
              {insights.performanceAnalysis.expectancy.toFixed(0)}₹
            </div>
            <div className="text-sm text-gray-600">Expectancy</div>
          </div>
          
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">
              {insights.performanceAnalysis.calmarRatio.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Calmar Ratio</div>
          </div>
          
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">
              {insights.performanceAnalysis.volatility.toFixed(0)}₹
            </div>
            <div className="text-sm text-gray-600">Volatility</div>
          </div>
        </div>
      </div>
    </div>
  );
} 