import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    console.log('Upstox OAuth test: Starting test flow');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client_id = process.env.UPSTOX_CLIENT_ID;
    const redirect_uri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/upstox/callback`;
    
    if (!client_id) {
      return NextResponse.json({ error: 'Upstox client ID not configured' }, { status: 500 });
    }

    // Create a test OAuth URL
    const encodedRedirectUri = encodeURIComponent(redirect_uri);
    const encodedState = encodeURIComponent(session.user.email);
    
    const oauthUrl = `https://api.upstox.com/v2/login/authorization/dialog?client_id=${client_id}&redirect_uri=${encodedRedirectUri}&response_type=code&state=${encodedState}`;
    
    const testInfo = {
      environment: {
        hasClientId: !!client_id,
        hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
        nextAuthUrl: process.env.NEXTAUTH_URL,
        redirectUri: redirect_uri,
        encodedRedirectUri: encodedRedirectUri
      },
      session: {
        userEmail: session.user.email,
        encodedState: encodedState
      },
      oauthUrl: oauthUrl,
      testSteps: [
        '1. Click the OAuth URL below to test the flow',
        '2. Complete the Upstox login',
        '3. Check if you are redirected back to the callback',
        '4. Check the console logs for detailed information'
      ]
    };

    console.log('Upstox OAuth test info:', testInfo);
    
    return NextResponse.json({
      success: true,
      testInfo,
      oauthUrl
    });
  } catch (error) {
    console.error('Upstox OAuth test error:', error);
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
} 