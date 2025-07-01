import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '../../lib/db';

export const dynamic = 'force-dynamic'

interface SkillMetrics {
  technical: number;
  risk: number;
  psychology: number;
  timing: number;
}

interface EvolutionPhase {
  phase: 'Discovery' | 'Skill Building' | 'Refinement' | 'Mastery';
  description: string;
  characteristics: string[];
  nextMilestone: string;
}

interface TimeWindow {
  start: Date;
  end: Date;
  trades: any[];
  skills: SkillMetrics;
  winRate: number;
  avgReturn: number;
  consistency: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, createdAt: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all trades for analysis
    const trades = await prisma.trade.findMany({
      where: { userId: user.id },
      orderBy: { entryDate: 'asc' },
      select: {
        id: true,
        entryDate: true,
        exitDate: true,
        profitLoss: true,
        tradeConfidence: true,
        confidenceLevel: true,
        preTradeEmotion: true,
        strategy: true,
        riskRewardRatio: true,
        stopLoss: true,
        lessons: true,
        lessonsLearned: true
      }
    });

    if (trades.length < 5) {
      return NextResponse.json({
        message: 'Need at least 5 trades for evolution analysis',
        totalTrades: trades.length,
        requiredTrades: 5
      });
    }

    // Analyze evolution
    const evolution = analyzeEvolution(trades);
    
    return NextResponse.json(evolution);

  } catch (error) {
    console.error('Evolution analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze evolution' }, { status: 500 });
  }
}

function analyzeEvolution(trades: any[]) {
  // Split into time periods
  const periods = createTimePeriods(trades);
  
  // Calculate skills for each period
  const skillProgression = periods.map(period => ({
    ...period,
    skills: calculateSkills(period.trades)
  }));

  // Detect current phase
  const currentPhase = detectPhase(skillProgression);
  
  return {
    totalTrades: trades.length,
    currentPhase,
    skillProgression,
    insights: generateInsights(skillProgression, currentPhase),
    nextMilestones: getNextMilestones(currentPhase)
  };
}

function createTimePeriods(trades: any[]) {
  const periodsCount = Math.min(6, Math.floor(trades.length / 8));
  const tradesPerPeriod = Math.floor(trades.length / periodsCount);
  const periods: any[] = [];
  
  for (let i = 0; i < periodsCount; i++) {
    const start = i * tradesPerPeriod;
    const end = i === periodsCount - 1 ? trades.length : (i + 1) * tradesPerPeriod;
    const periodTrades = trades.slice(start, end);
    
    if (periodTrades.length < 3) continue;
    
    const winRate = periodTrades.filter(t => (t.profitLoss || 0) > 0).length / periodTrades.length;
    
    periods.push({
      period: i + 1,
      trades: periodTrades,
      winRate,
      startDate: periodTrades[0].entryDate,
      endDate: periodTrades[periodTrades.length - 1].entryDate
    });
  }
  
  return periods;
}

function calculateSkills(trades: any[]) {
  // Technical Analysis (strategy usage)
  const strategicTrades = trades.filter(t => t.strategy && t.strategy.trim()).length;
  const technical = Math.min(100, (strategicTrades / trades.length) * 80 + 20);
  
  // Risk Management (stop loss usage)
  const stopLossTrades = trades.filter(t => t.stopLoss).length;
  const risk = Math.min(100, (stopLossTrades / trades.length) * 80 + 20);
  
  // Psychology (confidence accuracy)
  const confidenceTrades = trades.filter(t => t.tradeConfidence || t.confidenceLevel);
  let psychology = 50;
  if (confidenceTrades.length > 0) {
    const highConfTrades = confidenceTrades.filter(t => (t.tradeConfidence || t.confidenceLevel || 0) >= 7);
    if (highConfTrades.length > 0) {
      const accuracy = highConfTrades.filter(t => (t.profitLoss || 0) > 0).length / highConfTrades.length;
      psychology = Math.min(100, accuracy * 100);
    }
  }
  
  // Timing (win rate)
  const winRate = trades.filter(t => (t.profitLoss || 0) > 0).length / trades.length;
  const timing = Math.min(100, winRate * 100);
  
  return {
    technical: Math.round(technical),
    risk: Math.round(risk),
    psychology: Math.round(psychology),
    timing: Math.round(timing)
  };
}

function detectPhase(progression: any[]) {
  if (progression.length === 0) {
    return {
      phase: 'Discovery',
      description: 'Just starting your trading journey',
      characteristics: ['Learning basics', 'Inconsistent results']
    };
  }

  const latest = progression[progression.length - 1];
  const avgSkill = (latest.skills.technical + latest.skills.risk + latest.skills.psychology + latest.skills.timing) / 4;

  if (avgSkill >= 75) {
    return {
      phase: 'Mastery',
      description: 'Advanced trading skills developed',
      characteristics: ['Consistent performance', 'Strong discipline']
    };
  }

  if (avgSkill >= 60) {
    return {
      phase: 'Refinement',
      description: 'Fine-tuning your approach',
      characteristics: ['Building consistency', 'Better risk management']
    };
  }

  if (avgSkill >= 40) {
    return {
      phase: 'Skill Building',
      description: 'Developing core competencies',
      characteristics: ['Learning from mistakes', 'Developing strategies']
    };
  }

  return {
    phase: 'Discovery',
    description: 'Exploring fundamentals',
    characteristics: ['High variability', 'Building foundation']
  };
}

function generateInsights(progression: any[], phase: any) {
  if (progression.length === 0) {
    return {
      strengths: ['You\'re starting your trading journey'],
      challenges: ['Focus on building consistent habits'],
      recommendations: ['Start with a simple strategy', 'Track every trade']
    };
  }

  const latest = progression[progression.length - 1];
  const skills = latest.skills;
  
  const skillEntries = Object.entries(skills) as [string, number][];
  const strongest = skillEntries.reduce((a, b) => a[1] > b[1] ? a : b);
  const weakest = skillEntries.reduce((a, b) => a[1] < b[1] ? a : b);
  
  return {
    strengths: [
      `Your strongest skill: ${strongest[0]} (${strongest[1]}/100)`,
      latest.winRate >= 0.6 ? 'Good win rate' : null
    ].filter(Boolean),
    
    challenges: [
      `Focus on improving: ${weakest[0]} (${weakest[1]}/100)`,
      latest.winRate < 0.5 ? 'Work on win rate' : null
    ].filter(Boolean),
    
    recommendations: [
      `Priority: Develop ${weakest[0]} skills`,
      'Review your best trades weekly',
      'Track emotions before each trade'
    ]
  };
}

function getNextMilestones(phase: any) {
  const milestones = {
    'Discovery': ['Complete 25 trades', 'Develop a strategy'],
    'Skill Building': ['Use stop losses consistently', 'Achieve 55% win rate'],
    'Refinement': ['Maintain emotional discipline', 'Reach 65% win rate'],
    'Mastery': ['Scale position sizes', 'Mentor others']
  };
  
  return milestones[phase.phase] || ['Continue learning'];
} 