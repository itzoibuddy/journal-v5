import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    console.log('=== UPSTOX OAUTH INITIATION STARTED ===');
    console.log('Upstox OAuth: Starting OAuth flow');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.error('Upstox OAuth: No session found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const client_id = process.env.UPSTOX_CLIENT_ID;
    
    // Use the correct Upstox OAuth URL format
    const redirect_uri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/upstox/callback`;
    
    console.log('Upstox OAuth environment check:', {
      hasClientId: !!client_id,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      redirectUri: redirect_uri,
      clientIdLength: client_id?.length
    });
    
    if (!client_id) {
      console.error('Upstox OAuth: Client ID not configured');
      return NextResponse.json(
        { error: 'Upstox client ID not configured' },
        { status: 500 }
      );
    }

    // Use the correct Upstox OAuth URL as per their API documentation
    const encodedRedirectUri = encodeURIComponent(redirect_uri);
    const encodedState = encodeURIComponent(session.user.email);
    
    // Updated URL to match Upstox API v2 format
    const url = `https://api.upstox.com/v2/login/authorization/dialog?client_id=${client_id}&redirect_uri=${encodedRedirectUri}&response_type=code&state=${encodedState}`;
    
    console.log('Upstox OAuth: Redirecting to Upstox login:', {
      clientId: client_id.substring(0, 5) + '...',
      redirectUri: redirect_uri,
      encodedRedirectUri: encodedRedirectUri,
      state: session.user.email,
      encodedState: encodedState,
      fullUrl: url
    });
    
    console.log('=== UPSTOX OAUTH INITIATION COMPLETED ===');
    console.log('IMPORTANT: Make sure your Upstox app redirect URI is set to:', redirect_uri);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('=== UPSTOX OAUTH INITIATION ERROR ===');
    console.error('Error redirecting to Upstox OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to redirect to Upstox' },
      { status: 500 }
    );
  }
} 