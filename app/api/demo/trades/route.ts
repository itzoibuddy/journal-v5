import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

interface DemoTrade {
  id: string;
  symbol: string;
  type: 'LONG' | 'SHORT';
  instrumentType: string;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  entryDate: string;
  exitDate: string | null;
  profitLoss: number | null;
  strategy: string;
  platform: string;
  isSynced: boolean;
  platformTradeId: string | null;
  notes: string;
  tradeRating: number;
  marketCondition: string;
  createdAt: string;
  updatedAt: string;
}

// Demo trading data generator
function generateDemoTrades(count: number = 20): DemoTrade[] {
  const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA', 'NFLX', 'AMD', 'INTC'];
  const strategies = ['Breakout', 'Mean Reversion', 'Trend Following', 'Scalping', 'Swing Trading'];
  const platforms = ['Angel One', 'Zerodha', 'Upstox', 'Manual'];
  
  const trades: DemoTrade[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const isLong = Math.random() > 0.5;
    const entryDate = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Random date in last 30 days
    const isClosed = Math.random() > 0.3; // 70% chance of being closed
    const exitDate = isClosed ? new Date(entryDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000) : null;
    
    const entryPrice = Math.random() * 1000 + 100;
    const exitPrice = isClosed ? entryPrice + (Math.random() - 0.5) * 200 : null;
    const quantity = Math.floor(Math.random() * 100) + 10;
    const profitLoss = isClosed ? (exitPrice! - entryPrice) * quantity * (isLong ? 1 : -1) : null;
    
    trades.push({
      id: `demo-${i + 1}`,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      type: isLong ? 'LONG' : 'SHORT',
      instrumentType: 'STOCK',
      entryPrice: parseFloat(entryPrice.toFixed(2)),
      exitPrice: exitPrice ? parseFloat(exitPrice.toFixed(2)) : null,
      quantity,
      entryDate: entryDate.toISOString(),
      exitDate: exitDate ? exitDate.toISOString() : null,
      profitLoss: profitLoss ? parseFloat(profitLoss.toFixed(2)) : null,
      strategy: strategies[Math.floor(Math.random() * strategies.length)],
      platform: platforms[Math.floor(Math.random() * platforms.length)],
      isSynced: Math.random() > 0.5,
      platformTradeId: Math.random() > 0.5 ? `platform-${Math.floor(Math.random() * 1000)}` : null,
      notes: Math.random() > 0.7 ? 'Auto-synced from trading platform' : 'Manual entry',
      tradeRating: Math.floor(Math.random() * 5) + 1,
      marketCondition: ['Bullish', 'Bearish', 'Sideways'][Math.floor(Math.random() * 3)],
      createdAt: entryDate.toISOString(),
      updatedAt: exitDate ? exitDate.toISOString() : entryDate.toISOString()
    });
  }
  
  return trades.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '20');
    const platform = searchParams.get('platform');
    const live = searchParams.get('live') === 'true';

    let trades = generateDemoTrades(count);
    
    // Filter by platform if specified
    if (platform) {
      trades = trades.filter(trade => trade.platform === platform);
    }
    
    // For live data, return only recent trades
    if (live) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      trades = trades.filter(trade => new Date(trade.updatedAt) > oneHourAgo);
    }

    return NextResponse.json({
      success: true,
      data: trades,
      count: trades.length,
      platform: platform || 'all',
      live
    });

  } catch (error) {
    console.error('Demo trades error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, platform, count = 15 } = body;

    console.log('Demo trades POST request:', { action, platform, count });

    if (action === 'sync') {
      // Simulate platform sync
      const newTrades = generateDemoTrades(count).map(trade => ({
        ...trade,
        platform: platform || trade.platform,
        isSynced: true,
        notes: `Auto-synced from ${platform || trade.platform} - ${new Date().toLocaleString()}`,
        platformTradeId: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }));

      console.log(`Generated ${newTrades.length} demo trades for platform: ${platform}`);

      return NextResponse.json({
        success: true,
        action: 'sync',
        platform,
        tradesCreated: newTrades.length,
        tradesUpdated: 0,
        tradesSkipped: 0,
        totalFetched: newTrades.length,
        message: `Successfully generated ${newTrades.length} demo trades from ${platform}`,
        data: newTrades
      });
    }

    return NextResponse.json({ 
      error: 'Invalid action',
      details: 'Only "sync" action is supported'
    }, { status: 400 });

  } catch (error) {
    console.error('Demo sync error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 