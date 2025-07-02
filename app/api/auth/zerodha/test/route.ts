import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '../../../../lib/db';
import { ZerodhaPlatform } from '../../../../lib/trading-platforms/zerodha';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get Zerodha account
    const account = await prisma.tradingAccount.findFirst({
      where: {
        userId: user.id,
        platform: 'ZERODHA'
      }
    });

    if (!account) {
      return NextResponse.json({ error: 'Zerodha account not found' }, { status: 404 });
    }

    // Create Zerodha platform instance
    const platform = new ZerodhaPlatform({
      apiKey: account.apiKey || '',
      accessToken: account.accessToken || '',
      refreshToken: account.refreshToken || '',
      tokenExpiry: account.tokenExpiry || new Date()
    });

    // Test connection
    const testResult = await platform.testConnection();

    return NextResponse.json({
      success: true,
      testResult
    });

  } catch (error) {
    console.error('Zerodha test error:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 