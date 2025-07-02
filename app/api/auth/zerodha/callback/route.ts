import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '../../../../lib/db';
import { KiteConnect } from 'kiteconnect';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.error('Zerodha callback: No session found');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/auth/signin?error=unauthorized`);
    }

    const { searchParams } = new URL(request.url);
    const request_token = searchParams.get('request_token');
    const action = searchParams.get('action');
    const status = searchParams.get('status');

    console.log('Zerodha callback params:', { request_token: !!request_token, action, status });

    // Handle login failure
    if (action === 'login' && status === 'failed') {
      console.error('Zerodha login failed');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=zerodha_login_failed`);
    }

    if (!request_token) {
      console.error('Zerodha callback: No request token found');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=no_request_token`);
    }

    // Log the full request token for debugging
    console.log('Zerodha request token details:', {
      requestToken: request_token,
      requestTokenLength: request_token.length,
      isUrlEncoded: request_token.includes('%'),
      containsSpecialChars: /[^a-zA-Z0-9]/.test(request_token)
    });

    const api_key = process.env.ZERODHA_CLIENT_ID;
    const api_secret = process.env.ZERODHA_CLIENT_SECRET;
    
    // Enhanced validation with detailed logging
    console.log('Zerodha environment variables check:', {
      hasApiKey: !!api_key,
      apiKeyLength: api_key?.length || 0,
      hasApiSecret: !!api_secret,
      apiSecretLength: api_secret?.length || 0
    });
    
    if (!api_key || api_key.length < 6) {
      console.error('Zerodha callback: Invalid or missing API key', {
        hasApiKey: !!api_key,
        apiKeyLength: api_key?.length || 0,
        apiKeyValue: api_key ? `${api_key.substring(0, 3)}...` : 'undefined'
      });
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=zerodha_invalid_api_key`);
    }
    
    if (!api_secret || api_secret.length < 6) {
      console.error('Zerodha callback: Invalid or missing API secret', {
        hasApiSecret: !!api_secret,
        apiSecretLength: api_secret?.length || 0
      });
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=zerodha_invalid_api_secret`);
    }

    console.log('Zerodha callback: Exchanging request token for access token using KiteConnect SDK');

    // Use KiteConnect SDK for token exchange
    const kite = new KiteConnect({
      api_key: api_key
    });

    try {
      const kiteSession = await kite.generateSession(request_token, api_secret);
      
      console.log('Zerodha KiteConnect session generated:', {
        hasAccessToken: !!kiteSession.access_token,
        hasRefreshToken: !!kiteSession.refresh_token,
        userId: kiteSession.user_id,
        userType: kiteSession.user_type,
        loginTime: kiteSession.login_time
      });

      if (!kiteSession.access_token || !kiteSession.user_id) {
        console.error('Zerodha callback: Missing required tokens from KiteConnect session');
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=invalid_token_response`);
      }

      return await handleSuccessfulTokenExchange(kiteSession, session, request);
    } catch (error) {
      console.error('Zerodha KiteConnect session generation failed:', error);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=token_exchange_failed`);
    }
  } catch (error) {
    console.error('Error in Zerodha callback:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=callback_error`);
  }
}

async function handleSuccessfulTokenExchange(kiteSession: any, session: any, request: NextRequest) {
  console.log('Zerodha token exchange response data:', { 
    hasAccessToken: !!kiteSession.access_token, 
    hasRefreshToken: !!kiteSession.refresh_token, 
    userId: kiteSession.user_id,
    userType: kiteSession.user_type,
    loginTime: kiteSession.login_time
  });

  const access_token = kiteSession.access_token;
  const refresh_token = kiteSession.refresh_token || '';
  const user_id = kiteSession.user_id;

  console.log('Extracted tokens:', {
    accessToken: access_token ? `${access_token.substring(0, 10)}...` : 'undefined',
    refreshToken: refresh_token ? `${refresh_token.substring(0, 10)}...` : 'undefined',
    userId: user_id || 'undefined'
  });

  if (!access_token || !user_id) {
    console.error('Zerodha callback: Missing required tokens', { 
      hasAccessToken: !!access_token, 
      hasRefreshToken: !!refresh_token, 
      hasUserId: !!user_id
    });
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=invalid_token_response`);
  }

  console.log('Zerodha callback: Saving account to database');

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    console.error('Zerodha callback: User not found in database');
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=user_not_found`);
  }

  // Check if account already exists
  const existingAccount = await prisma.tradingAccount.findFirst({
    where: {
      userId: user.id,
      platform: 'ZERODHA'
    }
  });

  // Set token expiry to 24 hours from now (Zerodha tokens typically last 24 hours)
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (existingAccount) {
    // Update existing account
    await prisma.tradingAccount.update({
      where: { id: existingAccount.id },
      data: {
        apiKey: process.env.ZERODHA_CLIENT_ID, // Store API key
        accessToken: access_token,
        refreshToken: refresh_token || '', // Handle empty refresh token
        accountId: user_id,
        accountName: `Zerodha Account (${user_id})`,
        lastSyncAt: new Date(),
        syncStatus: 'CONNECTED',
        tokenExpiry: tokenExpiry, // Set token expiry
        updatedAt: new Date()
      }
    });
    console.log('Zerodha callback: Updated existing account');
  } else {
    // Create new account
    await prisma.tradingAccount.create({
      data: {
        userId: user.id,
        platform: 'ZERODHA',
        accountId: user_id,
        accountName: `Zerodha Account (${user_id})`,
        apiKey: process.env.ZERODHA_CLIENT_ID, // Store API key
        accessToken: access_token,
        refreshToken: refresh_token || '', // Handle empty refresh token
        isActive: true,
        syncStatus: 'CONNECTED',
        lastSyncAt: new Date(),
        tokenExpiry: tokenExpiry // Set token expiry
      }
    });
    console.log('Zerodha callback: Created new account');
  }

  console.log('Zerodha callback: Successfully connected, redirecting to brokers');
  
  // Trigger automatic trade sync after successful connection
  try {
    console.log('Zerodha callback: Starting automatic trade sync...');
    
    // Call the sync API to fetch trades from the last 90 days
    const syncResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/trading-platforms/sync`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '' // Forward session cookies
      },
      body: JSON.stringify({
        platform: 'ZERODHA',
        syncOptions: {
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
          endDate: new Date().toISOString()
        }
      })
    });
    
    if (syncResponse.ok) {
      const syncResult = await syncResponse.json();
      console.log('Zerodha automatic sync result:', {
        success: syncResult.success,
        tradesFetched: syncResult.totalFetched,
        tradesCreated: syncResult.totalTradesCreated,
        message: syncResult.message
      });
      
      // Trigger additional UI updates after successful sync
      try {
        // Revalidate all relevant pages to ensure UI is updated
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/trades');
        revalidatePath('/calendar');
        revalidatePath('/analytics');
        revalidatePath('/heatmaps');
        revalidatePath('/');
        revalidatePath('/brokers');
        console.log('Zerodha callback: Pages revalidated after sync');
      } catch (revalidateError) {
        console.warn('Zerodha callback: Failed to revalidate pages:', revalidateError);
      }
      
      // Trigger dashboard update for real-time UI updates
      try {
        const { dashboardUpdater } = await import('../../../../lib/trading-platforms/dashboard-updater');
        await dashboardUpdater.triggerUpdate({
          type: 'PLATFORM_SYNC',
          userId: user.id,
          data: {
            allPlatformResults: syncResult.allPlatformResults || [],
            totalTradesCreated: syncResult.totalTradesCreated || 0,
            totalTradesUpdated: syncResult.totalTradesUpdated || 0,
            totalTradesSkipped: syncResult.totalTradesSkipped || 0,
            totalFetched: syncResult.totalFetched || 0
          },
          timestamp: new Date()
        });
        console.log('Zerodha callback: Dashboard update triggered after sync');
      } catch (dashboardError) {
        console.warn('Zerodha callback: Failed to trigger dashboard update:', dashboardError);
      }
    } else {
      console.warn('Zerodha automatic sync failed:', syncResponse.status, await syncResponse.text());
    }
  } catch (syncError) {
    console.warn('Zerodha automatic sync error:', syncError);
    // Don't fail the OAuth flow if sync fails
  }
  
  return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?success=zerodha_connected&auto_sync=true`);
} 