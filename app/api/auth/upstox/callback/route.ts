import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '../../../../lib/db';

interface UpstoxUserProfile {
  data?: {
    user_id?: string;
    name?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== UPSTOX CALLBACK STARTED ===');
    console.log('Upstox callback: Starting OAuth callback process');
    console.log('Request URL:', request.url);
    console.log('Request method:', request.method);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    // Add a simple test response if no parameters are present
    const { searchParams } = new URL(request.url);
    if (!searchParams.has('code') && !searchParams.has('error')) {
      console.log('Upstox callback: No OAuth parameters found, returning test response');
      return NextResponse.json({
        message: 'Upstox callback endpoint is accessible',
        timestamp: new Date().toISOString(),
        url: request.url
      });
    }
    
    const session = await getServerSession(authOptions);
    console.log('Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email
    });
    
    if (!session?.user?.email) {
      console.error('Upstox callback: No session found');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/auth/signin?error=unauthorized`);
    }

    const { searchParams: urlSearchParams } = new URL(request.url);
    const code = urlSearchParams.get('code');
    const state = urlSearchParams.get('state');
    const error = urlSearchParams.get('error');

    console.log('Upstox callback params:', { 
      hasCode: !!code, 
      hasState: !!state, 
      hasError: !!error,
      error: error,
      code: code ? code.substring(0, 10) + '...' : null,
      state: state
    });

    // Handle OAuth errors
    if (error) {
      console.error('Upstox OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=upstox_${error}`);
    }

    if (!code) {
      console.error('Upstox callback: No authorization code found');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=no_authorization_code`);
    }

    const client_id = process.env.UPSTOX_CLIENT_ID;
    const client_secret = process.env.UPSTOX_CLIENT_SECRET;
    
    // Use the correct redirect URI format
    const redirect_uri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/upstox/callback`;
    
    console.log('Upstox environment check:', {
      hasClientId: !!client_id,
      hasClientSecret: !!client_secret,
      redirectUri: redirect_uri,
      clientIdLength: client_id?.length,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      expectedRedirectUri: 'http://localhost:3000/api/auth/upstox/callback'
    });
    
    if (!client_id || !client_secret) {
      console.error('Upstox callback: Missing credentials');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=upstox_not_configured`);
    }

    console.log('Upstox callback: Exchanging authorization code for access token');

    // Prepare the token exchange parameters
    const tokenParams = {
      code: code.toString(), // Ensure code is a string
      client_id,
      client_secret,
      redirect_uri,
      grant_type: 'authorization_code'
    };

    console.log('Token exchange parameters:', {
      hasCode: !!tokenParams.code,
      codeLength: tokenParams.code?.length,
      hasClientId: !!tokenParams.client_id,
      hasClientSecret: !!tokenParams.client_secret,
      redirectUri: tokenParams.redirect_uri,
      grantType: tokenParams.grant_type
    });

    // Try token exchange with different redirect URI formats if needed
    let tokenData: any = null;
    let tokenResponse: Response | null = null;
    
    const possibleRedirectUris = [
      redirect_uri,
      'http://localhost:3000/api/auth/upstox/callback',
      `${process.env.NEXTAUTH_URL}/api/auth/upstox/callback`
    ];

    for (const tryRedirectUri of possibleRedirectUris) {
      console.log(`Trying token exchange with redirect URI: ${tryRedirectUri}`);
      
      const tryTokenParams = {
        ...tokenParams,
        redirect_uri: tryRedirectUri
      };

      tokenResponse = await fetch('https://api.upstox.com/v2/login/authorization/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Api-Version': '2.0'
        },
        body: new URLSearchParams(tryTokenParams)
      });

      console.log(`Token exchange response status for ${tryRedirectUri}:`, tokenResponse.status);

      if (tokenResponse.ok) {
        tokenData = await tokenResponse.json();
        console.log('Token exchange successful with redirect URI:', tryRedirectUri);
        break;
      } else {
        const errorText = await tokenResponse.text();
        console.error(`Token exchange failed for ${tryRedirectUri}:`, tokenResponse.status, errorText);
        
        // Parse the error to check for specific Upstox error codes
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.errors && errorData.errors.length > 0) {
            const errorCode = errorData.errors[0].errorCode;
            const errorMessage = errorData.errors[0].message;
            
            console.log(`Upstox error code: ${errorCode}, message: ${errorMessage}`);
            
            // Handle specific error codes
            if (errorCode === 'UDAPI100058') {
              console.error('ACCOUNT REACTIVATION REQUIRED: User needs to reactivate their Upstox account');
              return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=account_reactivation_required&details=${encodeURIComponent(errorMessage)}`);
            }
            
            if (errorCode === 'UDAPI100057') {
              console.error('INVALID AUTH CODE: Authorization code has expired or been used');
              return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=invalid_auth_code&details=${encodeURIComponent(errorMessage)}`);
            }
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
      }
    }

    if (!tokenResponse || !tokenResponse.ok) {
      console.error('Upstox token exchange failed for all redirect URIs');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=token_exchange_failed&details=redirect_uri_mismatch`);
    }

    console.log('Upstox token exchange response status:', tokenResponse.status);
    console.log('Upstox token exchange response headers:', Object.fromEntries(tokenResponse.headers.entries()));

    console.log('Upstox token exchange response:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      error: tokenData.error,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in
    });

    if (tokenData.error) {
      console.error('Upstox API error:', tokenData);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=${tokenData.error}`);
    }

    const { access_token, refresh_token } = tokenData;

    // Get user profile from Upstox using correct API endpoint
    console.log('Upstox callback: Fetching user profile');
    const profileResponse = await fetch('https://api.upstox.com/v2/user/profile', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Api-Version': '2.0'
      }
    });

    console.log('Upstox profile response status:', profileResponse.status);
    
    let userProfile: UpstoxUserProfile | null = null;
    if (profileResponse.ok) {
      userProfile = await profileResponse.json() as UpstoxUserProfile;
      console.log('Upstox user profile:', userProfile);
    } else {
      const profileError = await profileResponse.text();
      console.error('Upstox profile fetch failed:', profileResponse.status, profileError);
      // Try alternative endpoint if the first one fails
      console.log('Trying alternative profile endpoint...');
      const altProfileResponse = await fetch('https://api.upstox.com/index/user/profile', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Api-Version': '2.0'
        }
      });
      
      if (altProfileResponse.ok) {
        userProfile = await altProfileResponse.json() as UpstoxUserProfile;
        console.log('Upstox user profile (alternative endpoint):', userProfile);
      } else {
        const altProfileError = await altProfileResponse.text();
        console.error('Alternative profile endpoint also failed:', altProfileResponse.status, altProfileError);
      }
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      console.error('Upstox callback: User not found in database');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=user_not_found`);
    }

    // Check if account already exists
    const existingAccount = await prisma.tradingAccount.findFirst({
      where: {
        userId: user.id,
        platform: 'UPSTOX'
      }
    });

    const accountName = userProfile?.data?.name || `Upstox Account (${userProfile?.data?.user_id || 'Unknown'})`;

    console.log('Upstox callback: Saving account to database', {
      existingAccount: !!existingAccount,
      accountName,
      userId: userProfile?.data?.user_id,
      userEmail: session.user.email
    });

    if (existingAccount) {
      // Update existing account
      await prisma.tradingAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          accountId: userProfile?.data?.user_id || existingAccount.accountId,
          accountName,
          lastSyncAt: new Date(),
          syncStatus: 'CONNECTED',
          updatedAt: new Date()
        }
      });
      console.log('Upstox callback: Updated existing account');
    } else {
      // Create new account
      await prisma.tradingAccount.create({
        data: {
          userId: user.id,
          platform: 'UPSTOX',
          accountId: userProfile?.data?.user_id || `upstox_${user.id}`,
          accountName,
          accessToken: access_token,
          refreshToken: refresh_token,
          isActive: true,
          syncStatus: 'CONNECTED',
          lastSyncAt: new Date()
        }
      });
      console.log('Upstox callback: Created new account');
    }

    // Trigger automatic trade sync after successful connection
    try {
      console.log('Upstox callback: Starting automatic trade sync...');
      
      // Call the sync API to fetch trades from the last 90 days
      const syncResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/trading-platforms/sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '' // Forward session cookies
        },
        body: JSON.stringify({
          platform: 'UPSTOX',
          syncOptions: {
            startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
            endDate: new Date().toISOString()
          }
        })
      });
      
      if (syncResponse.ok) {
        const syncResult = await syncResponse.json();
        console.log('Upstox automatic sync result:', {
          success: syncResult.success,
          tradesFetched: syncResult.totalFetched,
          tradesCreated: syncResult.totalTradesCreated,
          message: syncResult.message
        });
      } else {
        console.warn('Upstox automatic sync failed:', syncResponse.status, await syncResponse.text());
      }
    } catch (syncError) {
      console.warn('Upstox automatic sync error:', syncError);
      // Don't fail the OAuth flow if sync fails
    }

    console.log('Upstox callback: Successfully connected, redirecting to brokers');
    console.log('=== UPSTOX CALLBACK COMPLETED SUCCESSFULLY ===');
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?success=upstox_connected`);
  } catch (error) {
    console.error('=== UPSTOX CALLBACK ERROR ===');
    console.error('Error in Upstox callback:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=callback_error`);
  }
}