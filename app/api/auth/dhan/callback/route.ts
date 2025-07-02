import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '../../../../lib/db';

interface DhanUserProfile {
  data?: {
    userId?: string;
    name?: string;
    email?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/auth/signin?error=unauthorized`);
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=dhan_${error}`);
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=no_authorization_code`);
    }

    const client_id = process.env.DHAN_CLIENT_ID;
    const client_secret = process.env.DHAN_CLIENT_SECRET;
    const redirect_uri = process.env.DHAN_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/dhan/callback`;
    
    if (!client_id || !client_secret) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=dhan_not_configured`);
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.dhan.co/oauth/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id,
        client_secret,
        redirect_uri
      })
    });

    if (!tokenResponse.ok) {
      console.error('Dhan token exchange failed:', tokenResponse.status, tokenResponse.statusText);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('Dhan API error:', tokenData);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=${tokenData.error}`);
    }

    const { access_token, refresh_token } = tokenData;

    // Get user profile from Dhan
    const profileResponse = await fetch('https://api.dhan.co/user/profile', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    let userProfile: DhanUserProfile | null = null;
    if (profileResponse.ok) {
      userProfile = await profileResponse.json() as DhanUserProfile;
    }

    // Get user from database
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
        platform: 'DHAN'
      }
    });

    const accountName = userProfile?.data?.name || `Dhan Account (${userProfile?.data?.userId || 'Unknown'})`;

    if (existingAccount) {
      // Update existing account
      await prisma.tradingAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          accountId: userProfile?.data?.userId || existingAccount.accountId,
          accountName,
          lastSyncAt: new Date(),
          syncStatus: 'CONNECTED',
          updatedAt: new Date()
        }
      });
    } else {
      // Create new account
      await prisma.tradingAccount.create({
        data: {
          userId: user.id,
          platform: 'DHAN',
          accountId: userProfile?.data?.userId || `dhan_${user.id}`,
          accountName,
          accessToken: access_token,
          refreshToken: refresh_token,
          isActive: true,
          syncStatus: 'CONNECTED',
          lastSyncAt: new Date()
        }
      });
    }

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?success=dhan_connected`);
  } catch (error) {
    console.error('Error in Dhan callback:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/brokers?error=callback_error`);
  }
} 