'use client';

import { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
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
  ArcElement,
  BarElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function RiskManagementPage() {
  // Main calculator state
  const [accountSize, setAccountSize] = useState<number>(100000);
  const [riskPercentage, setRiskPercentage] = useState<number>(1);
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [stopLossPrice, setStopLossPrice] = useState<number>(0);
  const [takeProfitPrice, setTakeProfitPrice] = useState<number>(0);
  const [tradeType, setTradeType] = useState<'LONG' | 'SHORT'>('LONG');
  const [winRate, setWinRate] = useState<number>(60);
  const [instrumentType, setInstrumentType] = useState<'EQUITY' | 'OPTIONS' | 'FUTURES'>('EQUITY');

  // Default risk parameters by instrument type
  const defaultRiskParams = {
    EQUITY: { risk: 1, lotSize: 1, margin: 100 },
    FUTURES: { risk: 3, lotSize: 75, margin: 20 },
    OPTIONS: { risk: 4, lotSize: 75, margin: 100 }
  };
  
  // Advanced options
  const [lotSize, setLotSize] = useState<number>(1);
  const [marginRequired, setMarginRequired] = useState<number>(20); // percentage
  const [brokerage, setBrokerage] = useState<number>(0.05); // percentage
  
  // Calculated values
  const [calculations, setCalculations] = useState({
    maxRiskAmount: 0,
    positionSize: 0,
    riskRewardRatio: 0,
    potentialProfit: 0,
    potentialLoss: 0,
    expectedValue: 0,
    marginRequired: 0,
    brokerageCost: 0,
    netProfit: 0,
    netLoss: 0,
    breakEvenRate: 0,
    kellyPercent: 0
  });

  // Active tool
  const [activeTool, setActiveTool] = useState<'position' | 'portfolio' | 'correlation' | 'volatility'>('position');

  // Handle instrument type change with auto risk adjustment
  const handleInstrumentTypeChange = (newType: 'EQUITY' | 'OPTIONS' | 'FUTURES') => {
    const params = defaultRiskParams[newType];
    setInstrumentType(newType);
    setRiskPercentage(params.risk);
    setLotSize(params.lotSize);
    setMarginRequired(params.margin === 100 ? 100 : params.margin); // 100% means no leverage
  };

  // Portfolio risk state
  const [portfolioPositions, setPortfolioPositions] = useState([
    { symbol: 'RELIANCE', allocation: 25, risk: 2.5, correlation: 0.6 },
    { symbol: 'TCS', allocation: 20, risk: 2.0, correlation: 0.4 },
    { symbol: 'HDFC', allocation: 15, risk: 3.0, correlation: 0.7 },
    { symbol: 'ICICI', allocation: 15, risk: 2.8, correlation: 0.8 },
    { symbol: 'ITC', allocation: 10, risk: 1.5, correlation: 0.3 },
  ]);

  // Calculate all metrics
  useEffect(() => {
    if (accountSize && riskPercentage && entryPrice && stopLossPrice && entryPrice !== stopLossPrice) {
      const maxRisk = accountSize * (riskPercentage / 100);
      
      let riskPerUnit = 0;
      if (tradeType === 'LONG') {
        riskPerUnit = entryPrice - stopLossPrice;
      } else {
        riskPerUnit = stopLossPrice - entryPrice;
      }
      
      if (riskPerUnit > 0) {
        let calculatedPositionSize = maxRisk / riskPerUnit;
        
        // Adjust for lot size if derivatives
        if (instrumentType !== 'EQUITY') {
          calculatedPositionSize = Math.floor(calculatedPositionSize / lotSize) * lotSize;
        } else {
          calculatedPositionSize = Math.floor(calculatedPositionSize);
        }
        
        const potentialLoss = -1 * calculatedPositionSize * riskPerUnit;
        
        let potentialProfit = 0;
        let riskRewardRatio = 0;
        
        if (takeProfitPrice > 0) {
          let profitPerUnit = 0;
          if (tradeType === 'LONG') {
            profitPerUnit = takeProfitPrice - entryPrice;
          } else {
            profitPerUnit = entryPrice - takeProfitPrice;
          }
          
          potentialProfit = calculatedPositionSize * profitPerUnit;
          riskRewardRatio = profitPerUnit / riskPerUnit;
        }
        
        // Calculate brokerage and margin
        const brokerageCost = (calculatedPositionSize * entryPrice * brokerage) / 100;
        const marginReq = instrumentType !== 'EQUITY' ? (calculatedPositionSize * entryPrice * marginRequired) / 100 : calculatedPositionSize * entryPrice;
        
        // Expected value and Kelly criterion
        const winProb = winRate / 100;
        const lossProb = 1 - winProb;
        const expectedValue = (potentialProfit * winProb) + (potentialLoss * lossProb);
        
        // Kelly Criterion: f = (bp - q) / b where b = odds, p = win prob, q = loss prob
        const kellyPercent = riskRewardRatio > 0 ? ((riskRewardRatio * winProb) - lossProb) / riskRewardRatio : 0;
        
        // Break-even rate
        const breakEvenRate = riskRewardRatio > 0 ? (1 / (1 + riskRewardRatio)) * 100 : 0;
        
        setCalculations({
          maxRiskAmount: maxRisk,
          positionSize: calculatedPositionSize,
          riskRewardRatio,
          potentialProfit,
          potentialLoss,
          expectedValue,
          marginRequired: marginReq,
          brokerageCost,
          netProfit: potentialProfit - brokerageCost,
          netLoss: potentialLoss - brokerageCost,
          breakEvenRate,
          kellyPercent: Math.max(0, Math.min(kellyPercent * 100, 25)) // Cap at 25%
        });
      }
    }
  }, [accountSize, riskPercentage, entryPrice, stopLossPrice, takeProfitPrice, tradeType, winRate, instrumentType, lotSize, marginRequired, brokerage]);

  // Risk distribution chart data
  const riskDistributionData = {
    labels: ['Current Trade', 'Remaining Capital'],
    datasets: [{
      data: [calculations.maxRiskAmount, accountSize - calculations.maxRiskAmount],
      backgroundColor: ['#EF4444', '#10B981'],
      borderWidth: 0,
    }]
  };

  // Portfolio risk chart data
  const portfolioRiskData = {
    labels: portfolioPositions.map(p => p.symbol),
    datasets: [{
      label: 'Risk Contribution (%)',
      data: portfolioPositions.map(p => p.risk),
      backgroundColor: [
        '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'
      ],
      borderWidth: 1,
    }]
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
                  🛡️
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Risk Management Hub</h1>
                  <p className="text-sm text-gray-600">Professional trading risk tools and portfolio analysis</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tool Navigation */}
        <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6">
          <div className="flex flex-wrap gap-4">
            {[
              { id: 'position', label: 'Position Sizing', icon: '📊' },
              { id: 'portfolio', label: 'Portfolio Risk', icon: '📈' },
              { id: 'correlation', label: 'Correlation Matrix', icon: '🔗' },
              { id: 'volatility', label: 'Volatility Calculator', icon: '⚡' },
            ].map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id as any)}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  activeTool === tool.id
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="mr-2">{tool.icon}</span>
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        {/* Position Sizing Tool */}
        {activeTool === 'position' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Input Panel */}
              <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">🎯 Position Size Calculator</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account Size
                      </label>
                      <input
                        type="number"
                        value={accountSize}
                        onChange={(e) => setAccountSize(Number(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="₹100,000"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Risk per Trade: {riskPercentage}%
                        <span className="ml-2 text-xs text-blue-600">
                          (Auto-set for {instrumentType.toLowerCase()})
                        </span>
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={riskPercentage}
                        onChange={(e) => setRiskPercentage(Number(e.target.value))}
                        className="w-full h-2 bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Conservative</span>
                        <span>Aggressive</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Instrument Type
                      </label>
                      <select
                        value={instrumentType}
                        onChange={(e) => handleInstrumentTypeChange(e.target.value as any)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="EQUITY">📈 Equity (1% risk)</option>
                        <option value="FUTURES">⚡ Futures (3% risk)</option>
                        <option value="OPTIONS">🎯 Options (4% risk)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Trade Type
                        </label>
                        <select
                          value={tradeType}
                          onChange={(e) => setTradeType(e.target.value as any)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="LONG">📈 Long</option>
                          <option value="SHORT">📉 Short</option>
                        </select>
                      </div>

                      {instrumentType !== 'EQUITY' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Lot Size
                          </label>
                          <input
                            type="number"
                            value={lotSize}
                            onChange={(e) => setLotSize(Number(e.target.value))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="75"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Entry Price
                      </label>
                      <input
                        type="number"
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(Number(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="₹500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stop Loss Price
                      </label>
                      <input
                        type="number"
                        value={stopLossPrice}
                        onChange={(e) => setStopLossPrice(Number(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="₹480"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Take Profit Price
                      </label>
                      <input
                        type="number"
                        value={takeProfitPrice}
                        onChange={(e) => setTakeProfitPrice(Number(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="₹550"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expected Win Rate: {winRate}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={winRate}
                        onChange={(e) => setWinRate(Number(e.target.value))}
                        className="w-full h-2 bg-gradient-to-r from-red-400 via-yellow-400 to-green-500 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {instrumentType !== 'EQUITY' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Margin Required (%)
                          <span className="ml-2 text-xs text-gray-500">
                            (Auto-set for {instrumentType.toLowerCase()})
                          </span>
                        </label>
                        <input
                          type="number"
                          value={marginRequired}
                          onChange={(e) => setMarginRequired(Number(e.target.value))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="20"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Results Panel */}
              <div className="space-y-4">
                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">📊 Results</h4>
                  
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                      <div className="text-sm font-medium text-blue-700">Position Size</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {calculations.positionSize.toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-blue-600">
                        {instrumentType !== 'EQUITY' ? 'Lots' : 'Shares'}
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-lg border border-red-200">
                      <div className="text-sm font-medium text-red-700">Max Risk</div>
                      <div className="text-2xl font-bold text-red-900">
                        ₹{calculations.maxRiskAmount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-red-600">{riskPercentage}% of capital</div>
                    </div>

                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
                      <div className="text-sm font-medium text-purple-700">Risk:Reward</div>
                      <div className="text-2xl font-bold text-purple-900">
                        1:{calculations.riskRewardRatio.toFixed(2)}
                      </div>
                      <div className="text-xs text-purple-600">
                        {calculations.riskRewardRatio >= 2 ? '✅ Good' : calculations.riskRewardRatio >= 1 ? '⚠️ Okay' : '❌ Poor'}
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                      <div className="text-sm font-medium text-green-700">Expected Value</div>
                      <div className={`text-2xl font-bold ${calculations.expectedValue >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                        ₹{calculations.expectedValue.toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-green-600">
                        {calculations.expectedValue >= 0 ? '✅ Positive' : '❌ Negative'}
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-lg border border-yellow-200">
                      <div className="text-sm font-medium text-yellow-700">Kelly %</div>
                      <div className="text-2xl font-bold text-yellow-900">
                        {calculations.kellyPercent.toFixed(1)}%
                      </div>
                      <div className="text-xs text-yellow-600">Optimal risk size</div>
                    </div>

                    <div className="bg-gradient-to-r from-gray-50 to-slate-50 p-4 rounded-lg border border-gray-200">
                      <div className="text-sm font-medium text-gray-700">Break-even Rate</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {calculations.breakEvenRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Min win rate needed</div>
                    </div>
                  </div>
                </div>

                {/* Risk Distribution Chart */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">💰 Capital Allocation</h4>
                  <div className="h-48">
                    <Doughnut 
                      data={riskDistributionData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const value = context.parsed;
                                const percentage = ((value / accountSize) * 100).toFixed(1);
                                return `${context.label}: ₹${value.toLocaleString('en-IN')} (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Guidelines */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6">
              <h4 className="text-lg font-bold text-gray-900 mb-4">🎯 Trading Guidelines</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="font-semibold text-green-800">✅ Conservative</div>
                  <div className="text-sm text-green-700 mt-1">Risk: 0.5-1% | R:R {'>'}= 3:1</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="font-semibold text-blue-800">📊 Moderate</div>
                  <div className="text-sm text-blue-700 mt-1">Risk: 1-2% | R:R {'>'}= 2:1</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-yellow-800">⚠️ Aggressive</div>
                  <div className="text-sm text-yellow-700 mt-1">Risk: 2-3% | R:R {'>'}= 1.5:1</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="font-semibold text-red-800">🚨 High Risk</div>
                  <div className="text-sm text-red-700 mt-1">Risk: {'>'}3% | Not Recommended</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Portfolio Risk Tool */}
        {activeTool === 'portfolio' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">📈 Portfolio Risk Analysis</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Portfolio Positions</h4>
                <div className="space-y-3">
                  {portfolioPositions.map((position, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-gray-900">{position.symbol}</div>
                          <div className="text-sm text-gray-600">
                            {position.allocation}% allocation • {position.risk}% risk
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Correlation</div>
                          <div className="font-semibold text-gray-900">{position.correlation}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Risk Distribution</h4>
                <div className="h-64">
                  <Bar 
                    data={portfolioRiskData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Risk Contribution (%)'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder for other tools */}
        {activeTool === 'correlation' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">🔗 Correlation Matrix</h3>
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🚧</div>
              <p className="text-gray-500 text-lg">Correlation Matrix Tool</p>
              <p className="text-sm text-gray-400 mt-2">Coming soon - analyze correlations between your positions</p>
            </div>
          </div>
        )}

        {activeTool === 'volatility' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">⚡ Volatility Calculator</h3>
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-gray-500 text-lg">Volatility Analysis Tool</p>
              <p className="text-sm text-gray-400 mt-2">Coming soon - calculate implied volatility and VaR</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 