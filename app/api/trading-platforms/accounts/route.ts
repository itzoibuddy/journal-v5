import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/db';
import { TradingPlatformFactory, SupportedPlatform } from '../../../lib/trading-platforms/factory';
import { corsHeaders } from '../../../lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch all trading accounts for the user
    const accounts = await prisma.tradingAccount.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: accounts,
      message: 'Fetched trading accounts.'
    }, {
      headers: corsHeaders(request.headers.get('origin') || undefined),
    });
  } catch (error) {
    console.error('Error fetching trading accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trading accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    console.log('Received broker connect body:', body);
    const { platform, accountId, accountName, apiKey, apiSecret, accessToken, refreshToken, totp, state, clientcode, config } = body;

    // Validate platform
    if (!platform || !TradingPlatformFactory.getSupportedPlatforms().find(p => p.value === platform)) {
      return NextResponse.json(
        { error: 'Invalid or unsupported platform' },
        { status: 400 }
      );
    }

    // Validate required fields
    const platformConfig = TradingPlatformFactory.getPlatformConfig(platform as SupportedPlatform);
    if (platformConfig.requiresApiKey && !apiKey) {
      return NextResponse.json(
        { error: 'API Key is required for this platform' },
        { status: 400 }
      );
    }

    if (platformConfig.requiresApiSecret && !apiSecret) {
      return NextResponse.json(
        { error: 'API Secret is required for this platform' },
        { status: 400 }
      );
    }

    // Attempt to authenticate with the broker before saving the account
    const credentials = {
      apiKey,
      apiSecret,
      accessToken,
      refreshToken,
      totp: totp && totp.trim() !== '' ? totp : undefined, // Only include TOTP if provided and not empty
      state,
      clientcode,
      ...(config ? JSON.parse(config) : {})
    };
    console.log('Credentials for platform instance:', credentials);
    
    let authenticationBypassed = false;
    
    try {
      const platformInstance = TradingPlatformFactory.createPlatform(platform as SupportedPlatform, credentials);
      const isAuthenticated = await platformInstance.authenticate();
      if (!isAuthenticated) {
        // If the platform instance has a lastError property, return it
        const lastError = (platformInstance as any).lastError;
        console.error('Platform authentication failed:', {
          platform,
          error: lastError,
          hasTotp: !!totp,
          totpLength: totp ? totp.length : 0
        });
        
        // Return error instead of bypassing TOTP requirement
        return NextResponse.json(
          { error: lastError || 'Failed to authenticate with broker. Please check your credentials.' },
          { status: 400 }
        );
      } else {
        console.log('Platform authentication successful:', {
          platform,
          hasTotp: !!totp,
          totpLength: totp ? totp.length : 0
        });
      }
    } catch (authError) {
      console.error('Platform authentication error:', {
        platform,
        error: authError,
        hasTotp: !!totp,
        totpLength: totp ? totp.length : 0
      });
      
      // Return the actual error message if available
      const errorMessage = (authError instanceof Error ? authError.message : String(authError));
      return NextResponse.json(
        { error: errorMessage || 'Failed to authenticate with broker. Please check your credentials.' },
        { status: 400 }
      );
    }

    // Check if account already exists for this platform and user
    const existingAccount = await prisma.tradingAccount.findFirst({
      where: {
        userId: user.id,
        platform: platform
      }
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: `You already have a connected ${platform} account. Please disconnect the existing account first.` },
        { status: 400 }
      );
    }

    // Create the trading account
    let finalAccountId = accountId;
    if (!finalAccountId) {
      // Generate a default accountId if not provided (for non-credential brokers)
      finalAccountId = `${user.id}_${platform}`;
    }
    
    // Get access token from the authenticated instance
    let extractedAccessToken = null;
    let extractedRefreshToken = null;
    try {
      const platformInstance = TradingPlatformFactory.createPlatform(platform as SupportedPlatform, credentials);
      await platformInstance.authenticate(); // Re-authenticate to get fresh tokens
      
      // Access the private properties using bracket notation or type assertion
      const instance = platformInstance as any;
      extractedAccessToken = instance._accessToken || null;
      extractedRefreshToken = instance._refreshToken || null;
      
      console.log('Extracted tokens:', {
        hasAccessToken: !!extractedAccessToken,
        hasRefreshToken: !!extractedRefreshToken,
        accessTokenLength: extractedAccessToken ? (extractedAccessToken as string).length : 0
      });
    } catch (error) {
      console.log('Could not retrieve access token:', error);
    }
    
    const accountData = {
      userId: user.id,
      platform,
      accountId: finalAccountId,
      accountName: accountName || `${platform} Account`,
      apiKey,
      apiSecret,
      accessToken: extractedAccessToken,
      refreshToken: extractedRefreshToken,
      config: config ? JSON.stringify({ ...JSON.parse(config), clientcode, state, totp }) : JSON.stringify({ clientcode, state, totp }),
      isActive: true,
      syncStatus: 'PENDING', // Always PENDING for successful authentications
    };
    
    console.log('Creating trading account with data:', {
      ...accountData,
      apiSecret: '***HIDDEN***'
    });
    
    const newAccount = await prisma.tradingAccount.create({
      data: accountData
    });

    return NextResponse.json({
      success: true,
      message: 'Trading account created successfully.',
      data: newAccount
    }, {
      headers: corsHeaders(request.headers.get('origin') || undefined),
    });
  } catch (error) {
    console.error('Error creating trading account:', error);
    return NextResponse.json(
      { error: 'Failed to create trading account' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const platform = searchParams.get('platform');

    if (!accountId && !platform) {
      return NextResponse.json(
        { error: 'Account ID or platform is required' },
        { status: 400 }
      );
    }

    // Delete the trading account
    const whereClause: any = { userId: user.id };
    if (accountId) {
      whereClause.accountId = accountId;
    }
    if (platform) {
      whereClause.platform = platform;
    }

    const deletedAccount = await prisma.tradingAccount.deleteMany({
      where: whereClause
    });

    return NextResponse.json({
      success: true,
      message: 'Trading account deleted successfully.',
      data: { deletedCount: deletedAccount.count }
    }, {
      headers: corsHeaders(request.headers.get('origin') || undefined),
    });
  } catch (error) {
    console.error('Error deleting trading account:', error);
    return NextResponse.json(
      { error: 'Failed to delete trading account' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'cleanup-duplicates') {
      // Find all trading accounts for the user
      const accounts = await prisma.tradingAccount.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' }
      });

      // Group by platform and keep only the oldest account for each platform
      const platformGroups: { [key: string]: any[] } = {};
      accounts.forEach(account => {
        if (!platformGroups[account.platform]) {
          platformGroups[account.platform] = [];
        }
        platformGroups[account.platform].push(account);
      });

      // Delete duplicate accounts (keep the oldest one)
      let deletedCount = 0;
      for (const [platform, platformAccounts] of Object.entries(platformGroups)) {
        if (platformAccounts.length > 1) {
          // Keep the oldest account, delete the rest
          const accountsToDelete = platformAccounts.slice(1);
          const accountIdsToDelete = accountsToDelete.map(acc => acc.id);
          
          await prisma.tradingAccount.deleteMany({
            where: {
              id: { in: accountIdsToDelete }
            }
          });
          
          deletedCount += accountsToDelete.length;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Cleaned up ${deletedCount} duplicate accounts.`,
        data: { deletedCount }
      }, {
        headers: corsHeaders(request.headers.get('origin') || undefined),
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error cleaning up duplicate accounts:', error);
    return NextResponse.json(
      { error: 'Failed to clean up duplicate accounts' },
      { status: 500 }
    );
  }
} 