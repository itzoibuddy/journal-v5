import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/db';
import { AngelOnePlatform } from '../../../lib/trading-platforms/angel-one';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all Angel One trading accounts for this user
    const angelOneAccounts = await prisma.tradingAccount.findMany({
      where: {
        userId: user.id,
        platform: 'ANGEL_ONE'
      }
    });

    if (angelOneAccounts.length === 0) {
      return NextResponse.json({ error: 'No Angel One accounts found' }, { status: 404 });
    }

    let totalTradesUpdated = 0;
    let totalTradesProcessed = 0;

    for (const account of angelOneAccounts) {
      try {
        // Create Angel One platform instance
        const config = account.config ? JSON.parse(account.config) : {};
        const platform = new AngelOnePlatform({
          apiKey: account.apiKey || '',
          apiSecret: account.apiSecret || '',
          clientcode: config.clientcode || account.apiKey || '',
          accessToken: account.accessToken || '',
          refreshToken: account.refreshToken || '',
          state: config.state || '',
          totp: config.totp || ''
        });

        // Fetch fresh trades from Angel One
        const freshTrades = await platform.getTrades();
        console.log(`Fetched ${freshTrades.length} fresh trades from Angel One`);

        // Get existing Angel One trades from database
        const existingTrades = await prisma.trade.findMany({
          where: {
            userId: user.id,
            platform: 'ANGEL_ONE'
          }
        });

        console.log(`Found ${existingTrades.length} existing Angel One trades in database`);

        // Create a map of fresh trades by their unique identifier
        const freshTradesMap = new Map();
        freshTrades.forEach(trade => {
          const key = `${trade.symbol}_${trade.orderId}_${trade.entryDate}`;
          freshTradesMap.set(key, trade);
        });

        // Update existing trades with fresh data
        for (const existingTrade of existingTrades) {
          totalTradesProcessed++;
          
          // Try to find matching fresh trade
          const key = `${existingTrade.symbol}_${existingTrade.platformTradeId}_${existingTrade.entryDate}`;
          const freshTrade = freshTradesMap.get(key);

          if (freshTrade) {
            // Update the trade with fresh data
            await prisma.trade.update({
              where: { id: existingTrade.id },
              data: {
                entryPrice: freshTrade.entryPrice,
                exitPrice: freshTrade.exitPrice,
                quantity: freshTrade.quantity,
                profitLoss: freshTrade.profitLoss,
                updatedAt: new Date()
              }
            });
            totalTradesUpdated++;
            console.log(`Updated trade ${existingTrade.id} (${existingTrade.symbol}) with P&L: ${freshTrade.profitLoss}`);
          } else {
            console.log(`No fresh data found for trade ${existingTrade.id} (${existingTrade.symbol})`);
          }
        }

      } catch (error) {
        console.error(`Error processing account ${account.id}:`, error);
        return NextResponse.json({ 
          error: 'Failed to update trades for this account',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${totalTradesUpdated} out of ${totalTradesProcessed} Angel One trades`,
      totalTradesUpdated,
      totalTradesProcessed
    });

  } catch (error) {
    console.error('Error in update Angel One trades API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 