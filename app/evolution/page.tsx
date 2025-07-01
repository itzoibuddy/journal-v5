'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function EvolutionPage() {
  const [evolution, setEvolution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvolution();
  }, []);

  const fetchEvolution = async () => {
    try {
      const response = await fetch('/api/evolution');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch evolution data');
      }
      
      setEvolution(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 p-4">
        <div className="max-w-6xl mx-auto">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!evolution || evolution.message) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold text-yellow-800 mb-2">📊 Evolution Analysis</h2>
            <p className="text-yellow-600 mb-4">
              {evolution?.message || 'You need at least 5 trades to see your evolution analysis.'}
            </p>
            <p className="text-sm text-gray-600">
              Current trades: {evolution?.totalTrades || 0} / 5 required
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🧬 Trading Evolution Tracker
          </h1>
          <p className="text-gray-600 text-lg">
            Track your skill development journey • {evolution.totalTrades} trades analyzed
          </p>
        </div>

        {/* Current Phase */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20 mb-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full mb-4">
              <span className="text-2xl text-white font-bold">
                {getPhaseEmoji(evolution.currentPhase.phase)}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {evolution.currentPhase.phase} Phase
            </h2>
            <p className="text-gray-600 text-lg mb-4">
              {evolution.currentPhase.description}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {evolution.currentPhase.characteristics.map((char: string, index: number) => (
                <span
                  key={index}
                  className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
                >
                  {char}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Current Skills */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Current Skills</h3>
            <SkillMeter skills={evolution.skillProgression[evolution.skillProgression.length - 1]?.skills} />
          </div>

          {/* Skill Progression */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Skill Evolution</h3>
            <SkillProgressionChart progression={evolution.skillProgression} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Insights */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <h3 className="text-xl font-bold text-gray-900 mb-6">AI Insights</h3>
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                  <span className="mr-2">✅</span> Strengths
                </h4>
                <ul className="space-y-1">
                  {evolution.insights.strengths.map((strength: string, index: number) => (
                    <li key={index} className="text-green-700 text-sm pl-4 border-l-2 border-green-200">
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-orange-800 mb-2 flex items-center">
                  <span className="mr-2">⚠️</span> Focus Areas
                </h4>
                <ul className="space-y-1">
                  {evolution.insights.challenges.map((challenge: string, index: number) => (
                    <li key={index} className="text-orange-700 text-sm pl-4 border-l-2 border-orange-200">
                      {challenge}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
                  <span className="mr-2">💡</span> Action Plan
                </h4>
                <ul className="space-y-1">
                  {evolution.insights.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="text-blue-700 text-sm pl-4 border-l-2 border-blue-200">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Next Milestones */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Next Milestones</h3>
            <div className="space-y-3">
              {evolution.nextMilestones.map((milestone: string, index: number) => (
                <div key={index} className="flex items-start">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-white text-sm font-bold">{index + 1}</span>
                  </div>
                  <span className="text-gray-700 text-sm leading-relaxed">{milestone}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Win Rate Evolution */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Performance Evolution</h3>
          <WinRateChart progression={evolution.skillProgression} />
        </div>
      </div>
    </div>
  );
}

function getPhaseEmoji(phase: string): string {
  const emojis: Record<string, string> = {
    'Discovery': '🔍',
    'Skill Building': '🏗️',
    'Refinement': '⚡',
    'Mastery': '👑'
  };
  return emojis[phase] || '📈';
}

function SkillMeter({ skills }: { skills: any }) {
  if (!skills) return <div className="text-gray-500">No skill data available</div>;

  const skillNames: Record<string, string> = {
    technical: 'Technical Analysis',
    risk: 'Risk Management',
    psychology: 'Trading Psychology',
    timing: 'Market Timing'
  };

  return (
    <div className="space-y-4">
      {Object.entries(skills).map(([skill, value]) => {
        const numValue = Number(value);
        return (
          <div key={skill}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">
                {skillNames[skill] || skill}
              </span>
              <span className="text-sm font-bold text-gray-900">{numValue}/100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  numValue >= 70 ? 'bg-gradient-to-r from-green-400 to-green-600' : 
                  numValue >= 50 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 
                  'bg-gradient-to-r from-red-400 to-red-600'
                }`}
                style={{ width: `${numValue}%` }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SkillProgressionChart({ progression }: { progression: any[] }) {
  if (!progression || progression.length === 0) {
    return <div className="text-gray-500">No progression data available</div>;
  }

  const skills = ['technical', 'risk', 'psychology', 'timing'];
  const skillColors: Record<string, string> = {
    technical: 'bg-blue-500',
    risk: 'bg-green-500',
    psychology: 'bg-purple-500',
    timing: 'bg-orange-500'
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        Evolution across {progression.length} periods
      </div>
      
      {skills.map(skill => {
        const skillName: Record<string, string> = {
          technical: 'Technical',
          risk: 'Risk Mgmt',
          psychology: 'Psychology',
          timing: 'Timing'
        };

        const latestValue = progression[progression.length - 1]?.skills[skill] || 0;

        return (
          <div key={skill} className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">{skillName[skill]}</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {latestValue}/100
              </span>
            </div>
            <div className="flex items-end space-x-1 h-12 bg-gray-50 rounded p-2">
              {progression.map((period, index) => {
                const value = period.skills[skill];
                return (
                  <div
                    key={index}
                    className={`flex-1 ${skillColors[skill]} rounded-t opacity-80 hover:opacity-100 transition-opacity`}
                    style={{
                      height: `${Math.max(4, (value / 100) * 80)}%`,
                    }}
                    title={`Period ${period.period}: ${value}/100`}
                  ></div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WinRateChart({ progression }: { progression: any[] }) {
  if (!progression || progression.length === 0) {
    return <div className="text-gray-500">No win rate data available</div>;
  }

  const maxWinRate = Math.max(...progression.map(p => p.winRate));
  const minWinRate = Math.min(...progression.map(p => p.winRate));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Best Period</div>
          <div className="text-lg font-bold text-green-700">
            {Math.round(maxWinRate * 100)}%
          </div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Current Period</div>
          <div className="text-lg font-bold text-blue-700">
            {Math.round(progression[progression.length - 1].winRate * 100)}%
          </div>
        </div>
      </div>

      <div className="flex items-end space-x-2 h-32 bg-gray-50 rounded p-4">
        {progression.map((period, index) => {
          const winRatePercent = Math.round(period.winRate * 100);
          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-gradient-to-t from-blue-400 to-blue-600 rounded-t hover:from-blue-500 hover:to-blue-700 transition-colors"
                style={{
                  height: `${Math.max(8, (period.winRate * 100))}%`,
                }}
                title={`Period ${period.period}: ${winRatePercent}% win rate`}
              ></div>
              <span className="text-xs text-gray-600 mt-1">P{period.period}</span>
              <span className="text-xs font-bold text-gray-800">{winRatePercent}%</span>
            </div>
          );
        })}
      </div>
      
      <div className="text-sm text-gray-600 text-center">
        Win rate progression • Trend: {progression[progression.length - 1].winRate > progression[0].winRate ? '📈 Improving' : '📉 Declining'}
      </div>
    </div>
  );
} 