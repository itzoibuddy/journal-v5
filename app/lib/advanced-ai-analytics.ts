import { Trade } from '@prisma/client';

export interface AdvancedInsights {
  performanceAnalysis: {
    sharpeRatio: number;
    maxDrawdown: number;
    calmarRatio: number;
    winLossRatio: number;
    profitFactor: number;
    expectancy: number;
    consistency: number;
    volatility: number;
  };
  behavioralAnalysis: {
    overconfidenceScore: number;
    fearGreedIndex: number;
    disciplineScore: number;
    overtradingRisk: number;
    revengeTradingRisk: number;
    emotionalTrends: Array<{
      period: string;
      emotion: string;
      frequency: number;
      performance: number;
    }>;
    riskTolerance: 'Conservative' | 'Moderate' | 'Aggressive';
  };
  patternRecognition: {
    tradingStyles: Array<{
      style: string;
      frequency: number;
      success: number;
    }>;
    marketConditionPreference: {
      bullish: number;
      bearish: number;
      sideways: number;
    };
    timeOfDayAnalysis: Array<{
      hour: number;
      performance: number;
      volume: number;
    }>;
    setupReliability: Array<{
      setup: string;
      winRate: number;
      avgReturn: number;
      frequency: number;
    }>;
  };
  predictiveInsights: {
    nextTradeSuccess: number;
    optimalPositionSize: number;
    suggestedStrategies: string[];
    riskWarnings: string[];
    marketOutlook: string;
  };
  aiCoaching: {
    strengths: string[];
    weaknesses: string[];
    improvementAreas: string[];
    personalizedTips: string[];
    mentalGameAdvice: string[];
  };
}

export class AdvancedAIAnalytics {
  private trades: Trade[];

  constructor(trades: Trade[]) {
    this.trades = trades.filter(t => t.profitLoss !== null && t.exitDate !== null);
  }

  generateAdvancedInsights(): AdvancedInsights {
    return {
      performanceAnalysis: this.analyzePerformance(),
      behavioralAnalysis: this.analyzeBehavior(),
      patternRecognition: this.recognizePatterns(),
      predictiveInsights: this.generatePredictions(),
      aiCoaching: this.provideCoaching(),
    };
  }

  private analyzePerformance() {
    const returns = this.trades.map(t => t.profitLoss!);
    const winningTrades = returns.filter(r => r > 0);
    const losingTrades = returns.filter(r => r < 0);
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Sharpe Ratio (assuming risk-free rate of 6% annually)
    const riskFreeRate = 0.06 / 252; // Daily rate
    const sharpeRatio = stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev;
    
    // Max Drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let runningSum = 0;
    
    for (const ret of returns) {
      runningSum += ret;
      if (runningSum > peak) peak = runningSum;
      const drawdown = peak > 0 ? (peak - runningSum) / peak * 100 : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    // Calmar Ratio
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const calmarRatio = maxDrawdown === 0 ? 0 : totalReturn / maxDrawdown;
    
    // Win/Loss Ratio
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, r) => sum + r, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, r) => sum + r, 0) / losingTrades.length) : 0;
    const winLossRatio = avgLoss === 0 ? 0 : avgWin / avgLoss;
    
    // Profit Factor
    const grossProfit = winningTrades.reduce((sum, r) => sum + r, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, r) => sum + r, 0));
    const profitFactor = grossLoss === 0 ? 0 : grossProfit / grossLoss;
    
    // Expectancy
    const winRate = winningTrades.length / returns.length;
    const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);
    
    // Consistency (coefficient of variation)
    const consistency = stdDev === 0 ? 100 : Math.max(0, 100 - (stdDev / Math.abs(avgReturn)) * 100);
    
    return {
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      calmarRatio: Math.round(calmarRatio * 100) / 100,
      winLossRatio: Math.round(winLossRatio * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      expectancy: Math.round(expectancy * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      volatility: Math.round(stdDev * 100) / 100,
    };
  }

  private analyzeBehavior() {
    const emotionalTrades = this.trades.filter(t => t.preTradeEmotion || t.postTradeEmotion);
    const confidenceTrades = this.trades.filter(t => t.confidenceLevel || t.tradeConfidence);
    
    // Overconfidence Score
    const highConfidenceTrades = confidenceTrades.filter(t => (t.confidenceLevel || t.tradeConfidence || 0) >= 8);
    const highConfidenceWinRate = highConfidenceTrades.length > 0 ? 
      highConfidenceTrades.filter(t => t.profitLoss! > 0).length / highConfidenceTrades.length : 0;
    const overallWinRate = this.trades.filter(t => t.profitLoss! > 0).length / this.trades.length;
    const overconfidenceScore = Math.max(0, (overallWinRate - highConfidenceWinRate) * 100);
    
    // Fear/Greed Index based on position sizing and risk management
    const avgPosition = this.trades.reduce((sum, t) => sum + (t.quantity * t.entryPrice), 0) / this.trades.length;
    const positionVariance = this.trades.reduce((sum, t) => {
      const pos = t.quantity * t.entryPrice;
      return sum + Math.pow(pos - avgPosition, 2);
    }, 0) / this.trades.length;
    const fearGreedIndex = Math.min(100, Math.sqrt(positionVariance) / avgPosition * 100);
    
    // Discipline Score based on stop loss usage and risk management
    const stopLossTrades = this.trades.filter(t => t.stopLoss).length;
    const disciplineScore = (stopLossTrades / this.trades.length) * 100;
    
    // Emotional Trends
    const emotionMap: { [key: string]: { count: number; totalPnL: number } } = {};
    emotionalTrades.forEach(trade => {
      const emotion = trade.preTradeEmotion || 'neutral';
      if (!emotionMap[emotion]) {
        emotionMap[emotion] = { count: 0, totalPnL: 0 };
      }
      emotionMap[emotion].count++;
      emotionMap[emotion].totalPnL += trade.profitLoss!;
    });
    
    const emotionalTrends = Object.entries(emotionMap).map(([emotion, data]) => ({
      period: 'Overall',
      emotion,
      frequency: data.count,
      performance: data.totalPnL / data.count,
    }));
    
    // Risk Tolerance
    const avgRisk = this.trades.reduce((sum, t) => {
      const risk = t.stopLoss ? Math.abs(t.entryPrice - t.stopLoss) / t.entryPrice : 0.05;
      return sum + risk;
    }, 0) / this.trades.length;
    
    let riskTolerance: 'Conservative' | 'Moderate' | 'Aggressive';
    if (avgRisk < 0.02) riskTolerance = 'Conservative';
    else if (avgRisk < 0.05) riskTolerance = 'Moderate';
    else riskTolerance = 'Aggressive';
    
    // Over-trading detection: average trades per active day
    const firstDate = new Date(this.trades[this.trades.length - 1].entryDate);
    const lastDate = new Date(this.trades[0].entryDate);
    const daysActive = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const tradesPerDay = this.trades.length / daysActive;
    const overtradingRisk = Math.min(100, Math.max(0, (tradesPerDay - 5) * 20)); // >5 trades/day gradually maxes risk

    // Revenge-trading detection: losing trade followed by larger position within 1h
    let revengeCount = 0;
    for (let i = 0; i < this.trades.length - 1; i++) {
      const cur = this.trades[i];
      const next = this.trades[i + 1];
      if ((cur.profitLoss || 0) < 0) {
        const curValue = cur.quantity * cur.entryPrice;
        const nextValue = next.quantity * next.entryPrice;
        const timeDiff = Math.abs(new Date(next.entryDate).getTime() - new Date(cur.exitDate!).getTime());
        if (timeDiff < 60 * 60 * 1000 && nextValue > curValue * 1.2) {
          revengeCount++;
        }
      }
    }
    const revengeTradingRisk = Math.min(100, (revengeCount / this.trades.length) * 500); // heuristic

    return {
      overconfidenceScore: Math.round(overconfidenceScore),
      fearGreedIndex: Math.round(fearGreedIndex),
      disciplineScore: Math.round(disciplineScore),
      overtradingRisk: Math.round(overtradingRisk),
      revengeTradingRisk: Math.round(revengeTradingRisk),
      emotionalTrends,
      riskTolerance,
    };
  }

  private recognizePatterns() {
    // Trading Styles Analysis
    const strategyMap: { [key: string]: { count: number; wins: number } } = {};
    this.trades.forEach(trade => {
      const strategy = trade.strategy || 'Unknown';
      if (!strategyMap[strategy]) {
        strategyMap[strategy] = { count: 0, wins: 0 };
      }
      strategyMap[strategy].count++;
      if (trade.profitLoss! > 0) strategyMap[strategy].wins++;
    });
    
    const tradingStyles = Object.entries(strategyMap).map(([style, data]) => ({
      style,
      frequency: data.count,
      success: (data.wins / data.count) * 100,
    }));
    
    // Market Condition Preference
    const conditionMap = { bullish: 0, bearish: 0, sideways: 0 };
    this.trades.forEach(trade => {
      const condition = (trade.marketCondition || 'sideways').toLowerCase();
      if (condition.includes('bull')) conditionMap.bullish++;
      else if (condition.includes('bear')) conditionMap.bearish++;
      else conditionMap.sideways++;
    });
    
    // Time of Day Analysis
    const hourlyStats: { [key: number]: { count: number; totalPnL: number } } = {};
    this.trades.forEach(trade => {
      const hour = new Date(trade.entryDate).getHours();
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { count: 0, totalPnL: 0 };
      }
      hourlyStats[hour].count++;
      hourlyStats[hour].totalPnL += trade.profitLoss!;
    });
    
    const timeOfDayAnalysis = Object.entries(hourlyStats).map(([hour, data]) => ({
      hour: parseInt(hour),
      performance: data.totalPnL / data.count,
      volume: data.count,
    }));
    
    // Setup Reliability
    const setupMap: { [key: string]: { count: number; wins: number; totalPnL: number } } = {};
    this.trades.forEach(trade => {
      const setup = trade.setupDescription || 'Unknown Setup';
      if (!setupMap[setup]) {
        setupMap[setup] = { count: 0, wins: 0, totalPnL: 0 };
      }
      setupMap[setup].count++;
      setupMap[setup].totalPnL += trade.profitLoss!;
      if (trade.profitLoss! > 0) setupMap[setup].wins++;
    });
    
    const setupReliability = Object.entries(setupMap).map(([setup, data]) => ({
      setup,
      winRate: (data.wins / data.count) * 100,
      avgReturn: data.totalPnL / data.count,
      frequency: data.count,
    }));
    
    return {
      tradingStyles,
      marketConditionPreference: conditionMap,
      timeOfDayAnalysis,
      setupReliability,
    };
  }

  private generatePredictions() {
    const recentTrades = this.trades.slice(-20); // Last 20 trades
    const recentPerformance = recentTrades.length > 0 ? recentTrades.filter(t => t.profitLoss! > 0).length / recentTrades.length : 0.5;
    
    // Next Trade Success Probability
    const momentumFactor = recentPerformance > 0.6 ? 1.1 : recentPerformance < 0.4 ? 0.9 : 1.0;
    const baseWinRate = this.trades.length > 0 ? this.trades.filter(t => t.profitLoss! > 0).length / this.trades.length : 0.5;
    const nextTradeSuccess = Math.min(95, Math.max(5, baseWinRate * 100 * momentumFactor));
    
    // Optimal Position Size (Kelly Criterion)
    const winRate = baseWinRate;
    const winningTrades = this.trades.filter(t => t.profitLoss! > 0);
    const losingTrades = this.trades.filter(t => t.profitLoss! < 0);
    
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.profitLoss!, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, t) => sum + t.profitLoss!, 0) / losingTrades.length) : 0;
    const kelly = avgLoss > 0 ? (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin : 0.02;
    const optimalPositionSize = Math.max(0.01, Math.min(0.25, kelly)); // Cap at 25%
    
    // Strategy Suggestions
    const patterns = this.recognizePatterns();
    const bestStrategies = patterns.tradingStyles
      .filter(s => s.frequency >= 3)
      .sort((a, b) => b.success - a.success)
      .slice(0, 3)
      .map(s => s.style);
    
    const suggestedStrategies = bestStrategies.length > 0 ? 
      [`Focus on ${bestStrategies[0]} strategy (${patterns.tradingStyles.find(s => s.style === bestStrategies[0])?.success.toFixed(1)}% win rate)`] :
      ['Develop a consistent trading strategy'];
    
    // Risk Warnings
    const riskWarnings: string[] = [];
    const performance = this.analyzePerformance();
    if (performance.maxDrawdown > 20) riskWarnings.push('High drawdown detected - consider reducing position sizes');
    if (recentPerformance < 0.3) riskWarnings.push('Recent performance declining - take a break or review strategy');
    
    return {
      nextTradeSuccess: Math.round(nextTradeSuccess),
      optimalPositionSize: Math.round(optimalPositionSize * 10000) / 100, // As percentage
      suggestedStrategies,
      riskWarnings,
      marketOutlook: recentPerformance > 0.6 ? 'Positive momentum' : recentPerformance < 0.4 ? 'Cautious approach needed' : 'Neutral outlook',
    };
  }

  private provideCoaching() {
    const performance = this.analyzePerformance();
    const behavior = this.analyzeBehavior();
    const patterns = this.recognizePatterns();
    
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const improvementAreas: string[] = [];
    const personalizedTips: string[] = [];
    const mentalGameAdvice: string[] = [];
    
    // Analyze strengths
    if (performance.winLossRatio > 1.5) strengths.push('Excellent risk-reward management');
    if (performance.consistency > 70) strengths.push('Consistent trading performance');
    if (behavior.disciplineScore > 80) strengths.push('Strong discipline with stop losses');
    if (performance.sharpeRatio > 1) strengths.push('Strong risk-adjusted returns');
    
    // Identify weaknesses
    if (performance.maxDrawdown > 25) weaknesses.push('High drawdown periods');
    if (behavior.overconfidenceScore > 20) weaknesses.push('Overconfidence in high-conviction trades');
    if (performance.profitFactor < 1.2) weaknesses.push('Low profit factor');
    if (behavior.fearGreedIndex > 70) weaknesses.push('Inconsistent position sizing');
    
    // Improvement areas
    if (performance.sharpeRatio < 0.5) improvementAreas.push('Risk-adjusted returns optimization');
    if (behavior.disciplineScore < 60) improvementAreas.push('Stop loss discipline');
    if (performance.consistency < 50) improvementAreas.push('Trading consistency');
    
    // Personalized tips
    const bestHour = patterns.timeOfDayAnalysis.sort((a, b) => b.performance - a.performance)[0];
    if (bestHour) personalizedTips.push(`Your best trading hour is ${bestHour.hour}:00 - focus your energy then`);
    
    const bestSetup = patterns.setupReliability.sort((a, b) => b.winRate - a.winRate)[0];
    if (bestSetup && bestSetup.frequency >= 3) {
      personalizedTips.push(`Your "${bestSetup.setup}" setup has a ${bestSetup.winRate.toFixed(1)}% win rate - use it more`);
    }
    
    // Mental game advice
    if (behavior.fearGreedIndex > 60) {
      mentalGameAdvice.push('Practice position sizing discipline - fear and greed are affecting your trades');
    }
    if (behavior.overconfidenceScore > 15) {
      mentalGameAdvice.push('Stay humble - overconfidence can lead to larger losses');
    }
    mentalGameAdvice.push('Keep a trading journal to track your emotional state');
    mentalGameAdvice.push('Review losing trades to find improvement opportunities');
    
    return {
      strengths: strengths.length > 0 ? strengths : ['Building trading experience'],
      weaknesses: weaknesses.length > 0 ? weaknesses : [],
      improvementAreas: improvementAreas.length > 0 ? improvementAreas : [],
      personalizedTips: personalizedTips.length > 0 ? personalizedTips : ['Focus on developing a consistent strategy'],
      mentalGameAdvice,
    };
  }
}

export function generateMarketSentiment(trades: Trade[]): {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  confidence: number;
  reasoning: string[];
} {
  if (trades.length < 5) {
    return {
      sentiment: 'Neutral',
      confidence: 50,
      reasoning: ['Insufficient data for sentiment analysis'],
    };
  }

  const recentTrades = trades.slice(-10);
  const longTrades = recentTrades.filter(t => t.type === 'LONG');
  const shortTrades = recentTrades.filter(t => t.type === 'SHORT');
  const recentWinRate = recentTrades.filter(t => t.profitLoss! > 0).length / recentTrades.length;
  
  const reasoning: string[] = [];
  let sentimentScore = 0;
  
  // Analyze trade direction bias
  if (longTrades.length > shortTrades.length * 2) {
    sentimentScore += 20;
    reasoning.push(`${longTrades.length} long vs ${shortTrades.length} short trades indicate bullish bias`);
  } else if (shortTrades.length > longTrades.length * 2) {
    sentimentScore -= 20;
    reasoning.push(`${shortTrades.length} short vs ${longTrades.length} long trades indicate bearish bias`);
  }
  
  // Analyze recent performance
  if (recentWinRate > 0.7) {
    sentimentScore += 15;
    reasoning.push('High recent win rate suggests positive momentum');
  } else if (recentWinRate < 0.3) {
    sentimentScore -= 15;
    reasoning.push('Low recent win rate suggests caution needed');
  }
  
  // Determine sentiment
  let sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  if (sentimentScore > 20) sentiment = 'Bullish';
  else if (sentimentScore < -20) sentiment = 'Bearish';
  else sentiment = 'Neutral';
  
  const confidence = Math.min(95, Math.max(50, 50 + Math.abs(sentimentScore)));
  
  return { sentiment, confidence, reasoning };
} 