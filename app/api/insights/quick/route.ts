import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/db';

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

    // Get all trades for the user
    const trades = await prisma.trade.findMany({
      where: { userId: user.id },
      orderBy: { entryDate: 'desc' },
      select: {
        id: true,
        profitLoss: true,
        entryDate: true,
        exitDate: true,
        confidenceLevel: true,
        preTradeEmotion: true,
        lessonsLearned: true,
        setupDescription: true,
        quantity: true,
        entryPrice: true,
        exitPrice: true
      }
    });

    if (trades.length === 0) {
      return NextResponse.json({
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgWin: 0,
        avgLoss: 0,
        bestTrade: 0,
        worstTrade: 0,
        currentStreak: 0,
        riskReward: 0,
        emotionalInsights: {
          mostConfidentTrades: [],
          emotionalTrends: [],
          lessonsLearned: []
        },
        tradingPatterns: {
          bestDays: [],
          bestTimes: [],
          worstTimes: []
        },
        aiRecommendations: ['Start trading to receive AI insights!']
      });
    }

    // Calculate basic metrics
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => (t.profitLoss || 0) > 0);
    const losingTrades = trades.filter(t => (t.profitLoss || 0) < 0);
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
    const totalPnL = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);

    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / winningTrades.length 
      : 0;
    
    const avgLoss = losingTrades.length > 0 
      ? losingTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / losingTrades.length 
      : 0;

    const bestTrade = trades.reduce((max, t) => Math.max(max, t.profitLoss || 0), 0);
    const worstTrade = trades.reduce((min, t) => Math.min(min, t.profitLoss || 0), 0);

    // Calculate current streak
    let currentStreak = 0;
    for (let i = 0; i < trades.length; i++) {
      const pnl = trades[i].profitLoss || 0;
      if (i === 0) {
        currentStreak = pnl > 0 ? 1 : pnl < 0 ? -1 : 0;
      } else {
        const prevPnl = trades[i-1].profitLoss || 0;
        if ((pnl > 0 && prevPnl > 0) || (pnl < 0 && prevPnl < 0)) {
          currentStreak += pnl > 0 ? 1 : -1;
        } else {
          break;
        }
      }
    }

    const riskReward = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

    // Analyze trading patterns
    const dayStats: { [key: string]: { count: number, pnl: number } } = {};
    const timeStats: { [key: string]: { count: number, pnl: number } } = {};

    trades.forEach(trade => {
      const entryDate = new Date(trade.entryDate);
      const dayName = entryDate.toLocaleDateString('en-US', { weekday: 'long' });
      const hour = entryDate.getHours();
      const timeSlot = `${hour}:00-${hour + 1}:00`;

      // Day statistics
      if (!dayStats[dayName]) {
        dayStats[dayName] = { count: 0, pnl: 0 };
      }
      dayStats[dayName].count++;
      dayStats[dayName].pnl += trade.profitLoss || 0;

      // Time statistics
      if (!timeStats[timeSlot]) {
        timeStats[timeSlot] = { count: 0, pnl: 0 };
      }
      timeStats[timeSlot].count++;
      timeStats[timeSlot].pnl += trade.profitLoss || 0;
    });

    // Find best performing days and times
    const bestDays = Object.entries(dayStats)
      .filter(([_, stats]) => stats.count >= 2) // At least 2 trades
      .sort(([_, a], [__, b]) => (b.pnl / b.count) - (a.pnl / a.count))
      .slice(0, 3)
      .map(([day, _]) => day);

    const bestTimes = Object.entries(timeStats)
      .filter(([_, stats]) => stats.count >= 2)
      .sort(([_, a], [__, b]) => (b.pnl / b.count) - (a.pnl / a.count))
      .slice(0, 3)
      .map(([time, _]) => time);

    const worstTimes = Object.entries(timeStats)
      .filter(([_, stats]) => stats.count >= 2)
      .sort(([_, a], [__, b]) => (a.pnl / a.count) - (b.pnl / b.count))
      .slice(0, 2)
      .map(([time, _]) => time);

    // Emotional insights
    const confidenceTrades = trades
      .filter(t => t.confidenceLevel !== null && t.confidenceLevel !== undefined)
      .sort((a, b) => (b.confidenceLevel || 0) - (a.confidenceLevel || 0))
      .slice(0, 5);

    const lessonsLearned = trades
      .filter(t => t.lessonsLearned && t.lessonsLearned.trim() !== '')
      .map(t => t.lessonsLearned!)
      .slice(0, 5);

    // Generate AI recommendations
    const aiRecommendations: string[] = [];

    if (winRate < 50) {
      aiRecommendations.push('Your win rate is below 50%. Consider reviewing your entry criteria and risk management strategy.');
    }

    if (riskReward < 1) {
      aiRecommendations.push('Your risk-reward ratio is less than 1:1. Consider targeting higher profit targets or tighter stop losses.');
    }

    if (avgLoss > avgWin * 0.5) {
      aiRecommendations.push('Your average loss is significant compared to average win. Focus on cutting losses earlier.');
    }

    if (bestDays.length > 0) {
      aiRecommendations.push(`You perform best on ${bestDays.join(', ')}. Consider increasing position sizes on these days.`);
    }

    if (worstTimes.length > 0) {
      aiRecommendations.push(`Avoid trading during ${worstTimes.join(', ')} as these are your worst performing times.`);
    }

    if (currentStreak < -2) {
      aiRecommendations.push('You\'re in a losing streak. Consider taking a break and reviewing your recent trades for patterns.');
    }

    if (aiRecommendations.length === 0) {
      aiRecommendations.push('Your trading performance looks solid! Keep following your current strategy.');
    }

    return NextResponse.json({
      totalTrades,
      winRate,
      totalPnL,
      avgWin,
      avgLoss,
      bestTrade,
      worstTrade,
      currentStreak,
      riskReward,
      emotionalInsights: {
        mostConfidentTrades: confidenceTrades,
        emotionalTrends: [],
        lessonsLearned
      },
      tradingPatterns: {
        bestDays,
        bestTimes,
        worstTimes
      },
      aiRecommendations
    });

  } catch (error) {
    console.error('Error in AI insights API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 