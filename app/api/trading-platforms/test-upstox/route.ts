import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '../../../lib/db';
import { TradingPlatformFactory } from '../../../lib/trading-platforms/factory';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find Upstox account
    const upstoxAccount = await prisma.tradingAccount.findFirst({
      where: { 
        userId: user.id, 
        platform: 'UPSTOX',
        isActive: true 
      }
    });

    if (!upstoxAccount) {
      return NextResponse.json({
        success: false,
        message: 'No Upstox account found. Please connect your Upstox account first.',
        details: {
          hasAccount: false,
          accountStatus: 'NOT_CONNECTED'
        }
      });
    }

    console.log('Testing Upstox connection for user:', user.email);

    try {
      const config = upstoxAccount.config ? JSON.parse(upstoxAccount.config) : {};
      const platformInstance = TradingPlatformFactory.createPlatform('UPSTOX', {
        apiKey: upstoxAccount.apiKey || undefined,
        apiSecret: upstoxAccount.apiSecret || undefined,
        accessToken: upstoxAccount.accessToken || undefined,
        refreshToken: upstoxAccount.refreshToken || undefined,
        tokenExpiry: upstoxAccount.tokenExpiry || undefined,
        ...config,
      });

      // Test connection
      const testResult = await (platformInstance as any).testConnection();
      
      return NextResponse.json({
        success: true,
        message: 'Upstox connection test completed',
        accountInfo: {
          accountId: upstoxAccount.accountId,
          accountName: upstoxAccount.accountName,
          lastSyncAt: upstoxAccount.lastSyncAt,
          syncStatus: upstoxAccount.syncStatus,
          hasAccessToken: !!upstoxAccount.accessToken,
          hasRefreshToken: !!upstoxAccount.refreshToken,
          tokenExpiry: upstoxAccount.tokenExpiry
        },
        testResult: testResult
      });

    } catch (error) {
      console.error('Upstox connection test failed:', error);
      
      return NextResponse.json({
        success: false,
        message: 'Upstox connection test failed',
        accountInfo: {
          accountId: upstoxAccount.accountId,
          accountName: upstoxAccount.accountName,
          lastSyncAt: upstoxAccount.lastSyncAt,
          syncStatus: upstoxAccount.syncStatus,
          hasAccessToken: !!upstoxAccount.accessToken,
          hasRefreshToken: !!upstoxAccount.refreshToken,
          tokenExpiry: upstoxAccount.tokenExpiry
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      });
    }

  } catch (error) {
    console.error('Upstox test API error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 