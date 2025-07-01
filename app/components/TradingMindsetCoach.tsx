'use client';

import { useState, useEffect } from 'react';
import { AdvancedInsights } from '../lib/advanced-ai-analytics';

interface CoachingSession {
  id: string;
  title: string;
  type: 'strength' | 'weakness' | 'improvement' | 'mental';
  message: string;
  actionItems: string[];
  impact: 'high' | 'medium' | 'low';
  completed: boolean;
}

interface TradingMindsetCoachProps {
  insights: AdvancedInsights;
  onProgressUpdate?: (progress: number) => void;
}

export default function TradingMindsetCoach({ insights, onProgressUpdate }: TradingMindsetCoachProps) {
  const [activeSession, setActiveSession] = useState<CoachingSession | null>(null);
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [progress, setProgress] = useState(0);
  const [showMotivation, setShowMotivation] = useState(false);

  useEffect(() => {
    generateCoachingSessions();
  }, [insights]);

  const generateCoachingSessions = () => {
    const newSessions: CoachingSession[] = [];

    // Strength reinforcement sessions
    insights.aiCoaching.strengths.forEach((strength, index) => {
      newSessions.push({
        id: `strength-${index}`,
        title: `Leverage Your Strength: ${strength}`,
        type: 'strength',
        message: getStrengthMessage(strength),
        actionItems: getStrengthActions(strength),
        impact: 'medium',
        completed: false,
      });
    });

    // Weakness improvement sessions
    insights.aiCoaching.weaknesses.forEach((weakness, index) => {
      newSessions.push({
        id: `weakness-${index}`,
        title: `Address Weakness: ${weakness}`,
        type: 'weakness',
        message: getWeaknessMessage(weakness),
        actionItems: getWeaknessActions(weakness),
        impact: 'high',
        completed: false,
      });
    });

    // Mental game sessions
    insights.aiCoaching.mentalGameAdvice.forEach((advice, index) => {
      newSessions.push({
        id: `mental-${index}`,
        title: `Mental Game: ${advice.split(' - ')[0]}`,
        type: 'mental',
        message: advice,
        actionItems: getMentalGameActions(advice),
        impact: 'high',
        completed: false,
      });
    });

    // Behavioral coaching based on analysis
    if (insights.behavioralAnalysis.overconfidenceScore > 20) {
      newSessions.push({
        id: 'overconfidence',
        title: 'Managing Overconfidence',
        type: 'improvement',
        message: `Your overconfidence score is ${insights.behavioralAnalysis.overconfidenceScore}%. This suggests you may be taking larger risks when highly confident, which can lead to significant losses.`,
        actionItems: [
          'Reduce position size on high-confidence trades by 25%',
          'Create a pre-trade checklist to validate your confidence',
          'Track the correlation between confidence level and actual outcomes',
          'Practice saying "I could be wrong" before each trade'
        ],
        impact: 'high',
        completed: false,
      });
    }

    if (insights.behavioralAnalysis.fearGreedIndex > 70) {
      newSessions.push({
        id: 'position-sizing',
        title: 'Consistent Position Sizing',
        type: 'improvement',
        message: `Your Fear/Greed index is ${insights.behavioralAnalysis.fearGreedIndex}%, indicating inconsistent position sizing driven by emotions.`,
        actionItems: [
          'Create a position sizing formula based on account size',
          'Use the same risk percentage (1-2%) for each trade',
          'Write down your position size before looking at the chart',
          'Review trades where you deviated from your plan'
        ],
        impact: 'high',
        completed: false,
      });
    }

    setSessions(newSessions);
    updateProgress(newSessions);
  };

  const getStrengthMessage = (strength: string): string => {
    const messages: { [key: string]: string } = {
      'Excellent risk-reward management': 'You have mastered the art of risk-reward management! Your ability to cut losses short and let winners run is a significant competitive advantage. This discipline is what separates professional traders from amateurs.',
      'Consistent trading performance': 'Your consistency is remarkable! Consistent performance indicates that you have developed a reliable edge in the market and the discipline to execute it. This predictability is highly valuable for long-term success.',
      'Strong discipline with stop losses': 'Your discipline with stop losses is outstanding! This shows you understand that preservation of capital is paramount. Your ability to take small losses prevents catastrophic drawdowns.',
      'Strong risk-adjusted returns': 'Your Sharpe ratio indicates excellent risk-adjusted returns! You are generating profits while maintaining reasonable risk levels, which is the hallmark of sophisticated trading.',
    };
    return messages[strength] || `Great job with ${strength}! This is a valuable skill that will serve you well in your trading journey.`;
  };

  const getStrengthActions = (strength: string): string[] => {
    const actions: { [key: string]: string[] } = {
      'Excellent risk-reward management': [
        'Document your risk-reward process to replicate it consistently',
        'Teach others your approach to reinforce your own understanding',
        'Gradually increase position sizes to leverage this strength',
        'Create content about your risk management approach'
      ],
      'Consistent trading performance': [
        'Analyze what makes your performance consistent',
        'Create a performance review process to maintain consistency',
        'Consider increasing your trading frequency cautiously',
        'Document your consistent processes for future reference'
      ],
      'Strong discipline with stop losses': [
        'Share your stop loss strategy with other traders',
        'Consider tightening stops slightly to improve risk-reward',
        'Track your stop loss hit rate vs. target hit rate',
        'Create alerts to ensure you never skip setting stops'
      ],
    };
    return actions[strength] || ['Continue leveraging this strength', 'Share your approach with others', 'Build upon this foundation'];
  };

  const getWeaknessMessage = (weakness: string): string => {
    const messages: { [key: string]: string } = {
      'High drawdown periods': 'Drawdowns are inevitable in trading, but large drawdowns can be devastating both financially and psychologically. Learning to minimize drawdowns while maintaining profitability is crucial for long-term success.',
      'Overconfidence in high-conviction trades': 'Overconfidence can be a trader\'s biggest enemy. When we feel most certain, we often take the largest risks, which can lead to catastrophic losses. Even the best setups can fail.',
      'Low profit factor': 'A low profit factor indicates that your losses are eating into your profits significantly. This could be due to not letting winners run long enough or taking losses that are too large.',
      'Inconsistent position sizing': 'Inconsistent position sizing often stems from emotional decision-making rather than systematic risk management. This can lead to unnecessary volatility in your account.',
    };
    return messages[weakness] || `${weakness} is an area that needs attention. With focused effort, this can be improved significantly.`;
  };

  const getWeaknessActions = (weakness: string): string[] => {
    const actions: { [key: string]: string[] } = {
      'High drawdown periods': [
        'Implement a maximum daily/weekly loss limit',
        'Reduce position sizes during losing streaks',
        'Review correlation between your trades to avoid overexposure',
        'Consider taking breaks after significant losses'
      ],
      'Overconfidence in high-conviction trades': [
        'Cap position size on any single trade to 2% of account',
        'Create a devil\'s advocate checklist for high-confidence trades',
        'Track confidence levels vs. actual outcomes',
        'Practice humility meditation before trading sessions'
      ],
      'Low profit factor': [
        'Analyze your average win vs. average loss ratio',
        'Consider wider profit targets or tighter stop losses',
        'Review trades where you cut winners short',
        'Implement a trailing stop strategy'
      ],
    };
    return actions[weakness] || ['Focus on systematic improvement', 'Track progress weekly', 'Seek mentorship on this area'];
  };

  const getMentalGameActions = (advice: string): string[] => {
    if (advice.includes('position sizing')) {
      return [
        'Create a position sizing calculator',
        'Practice the 1% rule religiously',
        'Journal your emotional state when sizing positions',
        'Use meditation before position sizing decisions'
      ];
    }
    if (advice.includes('overconfidence')) {
      return [
        'Practice intellectual humility daily',
        'Create a "what could go wrong" checklist',
        'Reduce size on high-confidence trades',
        'Study famous trading disasters caused by overconfidence'
      ];
    }
    if (advice.includes('journal')) {
      return [
        'Write in your trading journal daily',
        'Track emotional state before and after trades',
        'Review journal entries weekly for patterns',
        'Share insights with a trading mentor'
      ];
    }
    return ['Practice mindfulness', 'Focus on process over outcomes', 'Maintain emotional balance'];
  };

  const updateProgress = (sessions: CoachingSession[]) => {
    const completed = sessions.filter(s => s.completed).length;
    const newProgress = sessions.length > 0 ? (completed / sessions.length) * 100 : 0;
    setProgress(newProgress);
    onProgressUpdate?.(newProgress);
  };

  const completeSession = (sessionId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => 
        s.id === sessionId ? { ...s, completed: true } : s
      );
      updateProgress(updated);
      return updated;
    });
    setActiveSession(null);
    setShowMotivation(true);
    setTimeout(() => setShowMotivation(false), 3000);
  };

  const getMotivationalMessage = () => {
    const messages = [
      "Great progress! Every step forward makes you a better trader.",
      "Consistency in improvement leads to consistency in profits!",
      "Your dedication to self-improvement is your greatest edge.",
      "Small daily improvements compound into major advantages.",
      "The best traders never stop learning and growing.",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getSessionIcon = (type: string) => {
    switch (type) {
      case 'strength': return '💪';
      case 'weakness': return '🎯';
      case 'improvement': return '📈';
      case 'mental': return '🧠';
      default: return '📚';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">🎯 AI Trading Coach</h2>
          <div className="text-right">
            <div className="text-sm text-gray-600">Progress</div>
            <div className="text-2xl font-bold text-purple-600">{Math.round(progress)}%</div>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div 
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <p className="text-gray-600">
          Complete coaching sessions to improve your trading psychology and performance.
          {sessions.filter(s => !s.completed).length > 0 && 
            ` ${sessions.filter(s => !s.completed).length} sessions remaining.`
          }
        </p>
      </div>

      {/* Motivational Message */}
      {showMotivation && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 animate-bounce">
          <div className="flex items-center">
            <span className="text-2xl mr-3">🎉</span>
            <p className="text-green-800 font-medium">{getMotivationalMessage()}</p>
          </div>
        </div>
      )}

      {/* Active Session */}
      {activeSession && (
        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-blue-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <span className="text-3xl mr-3">{getSessionIcon(activeSession.type)}</span>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{activeSession.title}</h3>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(activeSession.impact)}`}>
                  {activeSession.impact.toUpperCase()} IMPACT
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveSession(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-700 leading-relaxed">{activeSession.message}</p>
          </div>
          
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">Action Items:</h4>
            <ul className="space-y-2">
              {activeSession.actionItems.map((item, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-500 mr-2 mt-1">•</span>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => completeSession(activeSession.id)}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-6 rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200"
            >
              Complete Session
            </button>
            <button
              onClick={() => setActiveSession(null)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200"
            >
              Skip for Now
            </button>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Coaching Sessions</h3>
        
        {sessions.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <div className="text-4xl mb-2">🚀</div>
            <p className="text-gray-600">No coaching sessions available yet.</p>
            <p className="text-sm text-gray-500">Complete more trades to unlock AI coaching insights.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md ${
                session.completed 
                  ? 'bg-green-50 border-green-200 opacity-75' 
                  : 'bg-white border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => !session.completed && setActiveSession(session)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{getSessionIcon(session.type)}</span>
                  <div>
                    <h4 className={`font-medium ${session.completed ? 'text-green-700' : 'text-gray-900'}`}>
                      {session.title}
                    </h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(session.impact)}`}>
                        {session.impact.toUpperCase()}
                      </span>
                      {session.completed && (
                        <span className="text-green-600 text-xs font-medium">✓ COMPLETED</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {!session.completed && (
                  <div className="text-blue-500 hover:text-blue-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{sessions.filter(s => s.type === 'strength').length}</div>
          <div className="text-sm text-purple-700">Strengths Identified</div>
        </div>
        
        <div className="bg-orange-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{sessions.filter(s => s.type === 'weakness').length}</div>
          <div className="text-sm text-orange-700">Areas to Improve</div>
        </div>
        
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{sessions.filter(s => s.type === 'mental').length}</div>
          <div className="text-sm text-blue-700">Mental Game Sessions</div>
        </div>
      </div>
    </div>
  );
} 