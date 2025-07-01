import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/db';
import { AdvancedAIAnalytics, generateMarketSentiment } from '../../../lib/advanced-ai-analytics';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all completed trades for the user
    const trades = await prisma.trade.findMany({
      where: { 
        userId: user.id,
        profitLoss: { not: null },
        exitDate: { not: null }
      },
      orderBy: { entryDate: 'desc' },
    });

    if (trades.length < 5) {
      return NextResponse.json({
        error: 'Insufficient data',
        message: 'Need at least 5 completed trades for advanced insights',
        requiredTrades: 5,
        currentTrades: trades.length
      }, { status: 400 });
    }

    // Generate advanced insights
    const analytics = new AdvancedAIAnalytics(trades);
    const advancedInsights = analytics.generateAdvancedInsights();
    
    // Generate market sentiment
    const marketSentiment = generateMarketSentiment(trades);

    // Calculate additional metrics
    const totalTrades = trades.length;
    const recentTrades = trades.slice(0, 10);
    const totalPnL = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const winningTrades = trades.filter(t => (t.profitLoss || 0) > 0);
    const winRate = (winningTrades.length / totalTrades) * 100;

    // Best and worst performing setups
    const setupPerformance = trades.reduce((acc, trade) => {
      const setup = trade.setupDescription || 'Unknown';
      if (!acc[setup]) {
        acc[setup] = { trades: [], totalPnL: 0 };
      }
      acc[setup].trades.push(trade);
      acc[setup].totalPnL += trade.profitLoss || 0;
      return acc;
    }, {} as any);

    const topSetups = Object.entries(setupPerformance)
      .filter(([_, data]: any) => data.trades.length >= 3)
      .sort(([_, a]: any, [__, b]: any) => b.totalPnL - a.totalPnL)
      .slice(0, 5)
      .map(([setup, data]: any) => ({
        setup,
        trades: data.trades.length,
        totalPnL: data.totalPnL,
        avgPnL: data.totalPnL / data.trades.length,
        winRate: (data.trades.filter((t: any) => t.profitLoss > 0).length / data.trades.length) * 100
      }));

    // Recent performance trend
    const monthlyPerformance: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthTrades = trades.filter(t => {
        const tradeDate = new Date(t.entryDate);
        return tradeDate >= monthStart && tradeDate <= monthEnd;
      });
      
      if (monthTrades.length > 0) {
        const monthPnL = monthTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
        const monthWinRate = (monthTrades.filter(t => (t.profitLoss || 0) > 0).length / monthTrades.length) * 100;
        
        monthlyPerformance.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          pnl: monthPnL,
          winRate: monthWinRate,
          trades: monthTrades.length
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        // Core metrics
        totalTrades,
        totalPnL,
        winRate,
        recentTrades: recentTrades.length,
        
        // Advanced insights
        ...advancedInsights,
        
        // Market sentiment
        marketSentiment,
        
        // Additional insights
        topPerformingSetups: topSetups,
        monthlyPerformance,
        
        // Trend analysis
        trends: {
          improving: winRate > 50 && advancedInsights.performanceAnalysis.consistency > 60,
          declining: winRate < 40 || advancedInsights.performanceAnalysis.maxDrawdown > 25,
          stable: winRate >= 40 && winRate <= 60 && advancedInsights.performanceAnalysis.consistency > 40
        },
        
        // Risk assessment
        riskLevel: advancedInsights.performanceAnalysis.maxDrawdown > 20 ? 'High' : 
                  advancedInsights.performanceAnalysis.maxDrawdown > 10 ? 'Medium' : 'Low',
        
        // Performance grade
        performanceGrade: getPerformanceGrade(advancedInsights),
        
        // AI recommendations priority
        priorityActions: getPriorityActions(advancedInsights),
        
        // Emotional state analysis
        emotionalState: getEmotionalState(advancedInsights.behavioralAnalysis),
        
        // Generated timestamp
        generatedAt: new Date().toISOString(),
        
        // Data freshness
        lastTradeDate: trades[0]?.entryDate,
        analysisReliability: totalTrades >= 20 ? 'High' : totalTrades >= 10 ? 'Medium' : 'Low'
      }
    });

  } catch (error) {
    console.error('Error in advanced AI insights API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function getPerformanceGrade(insights: any) {
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

  const sharpeScore = Math.min(100, Math.max(0, (insights.performanceAnalysis.sharpeRatio + 2) * 25));
  const profitScore = Math.min(100, Math.max(0, (insights.performanceAnalysis.profitFactor - 0.5) * 50));
  const consistencyScore = insights.performanceAnalysis.consistency;
  const drawdownScore = Math.max(0, 100 - insights.performanceAnalysis.maxDrawdown * 2);
  const winLossScore = Math.min(100, insights.performanceAnalysis.winLossRatio * 50);
  const disciplineScore = insights.behavioralAnalysis.disciplineScore;
  const overtradingScore = 100 - insights.behavioralAnalysis.overtradingRisk;
  const revengeScore = 100 - insights.behavioralAnalysis.revengeTradingRisk;

  const overallScore = Math.round(
    sharpeScore * weights.sharpeRatio +
    profitScore * weights.profitFactor +
    consistencyScore * weights.consistency +
    drawdownScore * weights.maxDrawdown +
    winLossScore * weights.winLossRatio +
    disciplineScore * weights.disciplineScore +
    overtradingScore * weights.overtradingRisk +
    revengeScore * weights.revengeTradingRisk
  );

  if (overallScore >= 90) return { grade: 'A+', score: overallScore, description: 'Exceptional Performance' };
  if (overallScore >= 80) return { grade: 'A', score: overallScore, description: 'Excellent Performance' };
  if (overallScore >= 70) return { grade: 'B+', score: overallScore, description: 'Good Performance' };
  if (overallScore >= 60) return { grade: 'B', score: overallScore, description: 'Above Average' };
  if (overallScore >= 50) return { grade: 'C+', score: overallScore, description: 'Average Performance' };
  if (overallScore >= 40) return { grade: 'C', score: overallScore, description: 'Below Average' };
  return { grade: 'D', score: overallScore, description: 'Needs Improvement' };
}

function getPriorityActions(insights: any) {
  const actions: any[] = [];
  
  // High priority issues
  if (insights.performanceAnalysis.maxDrawdown > 25) {
    actions.push({
      priority: 'Critical',
      action: 'Reduce position sizes immediately',
      reason: `Max drawdown of ${insights.performanceAnalysis.maxDrawdown.toFixed(1)}% is dangerously high`,
      impact: 'Risk Management'
    });
  }
  
  if (insights.behavioralAnalysis.overconfidenceScore > 30) {
    actions.push({
      priority: 'High',
      action: 'Implement position size limits',
      reason: 'Overconfidence is leading to oversized positions',
      impact: 'Behavioral Control'
    });
  }
  
  if (insights.performanceAnalysis.profitFactor < 1.1) {
    actions.push({
      priority: 'High',
      action: 'Review exit strategy',
      reason: 'Low profit factor indicates losses are eating into profits',
      impact: 'Strategy Optimization'
    });
  }
  
  if (insights.behavioralAnalysis.overtradingRisk > 40) {
    actions.push({
      priority: 'High',
      action: 'Reduce trade frequency',
      reason: 'Overtrading detected — average trades per day is high',
      impact: 'Behavioral Control'
    });
  }
  
  if (insights.behavioralAnalysis.revengeTradingRisk > 20) {
    actions.push({
      priority: 'High',
      action: 'Avoid revenge trading',
      reason: 'Taking larger positions immediately after a loss increases risk',
      impact: 'Emotional Control'
    });
  }
  
  // Medium priority improvements
  if (insights.behavioralAnalysis.disciplineScore < 70) {
    actions.push({
      priority: 'Medium',
      action: 'Improve stop loss discipline',
      reason: 'Inconsistent risk management detected',
      impact: 'Risk Management'
    });
  }
  
  if (insights.performanceAnalysis.consistency < 60) {
    actions.push({
      priority: 'Medium',
      action: 'Focus on consistent strategy execution',
      reason: 'Performance volatility is too high',
      impact: 'Strategy Development'
    });
  }
  
  return actions.slice(0, 5); // Top 5 priority actions
}

function getEmotionalState(behavioralAnalysis: any) {
  const { overconfidenceScore, fearGreedIndex, disciplineScore, riskTolerance } = behavioralAnalysis;
  
  if (overconfidenceScore > 25 && fearGreedIndex > 70) {
    return {
      state: 'Euphoric/Risky',
      description: 'High overconfidence combined with emotional trading',
      recommendation: 'Take a break and reassess your approach',
      color: 'red'
    };
  }
  
  if (disciplineScore > 80 && overconfidenceScore < 15) {
    return {
      state: 'Disciplined',
      description: 'Excellent emotional control and discipline',
      recommendation: 'Maintain current mental approach',
      color: 'green'
    };
  }
  
  if (fearGreedIndex > 60) {
    return {
      state: 'Emotional',
      description: 'Fear and greed are influencing decisions',
      recommendation: 'Practice mindfulness and systematic decision making',
      color: 'orange'
    };
  }
  
  return {
    state: 'Balanced',
    description: 'Reasonable emotional control',
    recommendation: 'Continue building mental discipline',
    color: 'blue'
  };
} 