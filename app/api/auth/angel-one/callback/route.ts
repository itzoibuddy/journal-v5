import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=unauthorized`);
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Angel One OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=oauth_failed&message=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=no_code`);
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://smartapi.angelbroking.com/rest/auth/angelbroking/jwt/v1/generateTokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientcode: process.env.ANGEL_ONE_CLIENT_ID,
        password: process.env.ANGEL_ONE_CLIENT_SECRET,
        totp: '', // TOTP will be handled separately
        state: state || ''
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Failed to exchange code for token:', await tokenResponse.text());
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.data || !tokenData.data.jwtToken) {
      console.error('Invalid token response:', tokenData);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=invalid_token_response`);
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=user_not_found`);
    }

    // Check if account already exists
    const existingAccount = await prisma.tradingAccount.findFirst({
      where: {
        userId: user.id,
        platform: 'ANGEL_ONE'
      }
    });

    if (existingAccount) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=account_exists`);
    }

    // Create the trading account
    const accountData = {
      userId: user.id,
      platform: 'ANGEL_ONE',
      accountId: `${user.id}_ANGEL_ONE`,
      accountName: 'Angel One Account',
      apiKey: process.env.ANGEL_ONE_CLIENT_ID || '',
      apiSecret: process.env.ANGEL_ONE_CLIENT_SECRET || '',
      accessToken: tokenData.data.jwtToken,
      refreshToken: tokenData.data.refreshToken || null,
      config: JSON.stringify({
        clientcode: process.env.ANGEL_ONE_CLIENT_ID,
        state: state || '',
        tokenExpiry: tokenData.data.tokenExpiryTime ? new Date(Date.now() + tokenData.data.tokenExpiryTime) : null
      }),
      isActive: true,
      syncStatus: 'PENDING',
    };

    await prisma.tradingAccount.create({
      data: accountData
    });

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?success=angel_one_connected`);
  } catch (error) {
    console.error('Error in Angel One callback:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=callback_failed`);
  }
} 