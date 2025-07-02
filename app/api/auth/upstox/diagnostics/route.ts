import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    console.log('Upstox diagnostics: Checking OAuth configuration');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client_id = process.env.UPSTOX_CLIENT_ID;
    const client_secret = process.env.UPSTOX_CLIENT_SECRET;
    const redirect_uri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/upstox/callback`;
    const nextAuthUrl = process.env.NEXTAUTH_URL;

    const diagnostics = {
      environment: {
        hasClientId: !!client_id,
        hasClientSecret: !!client_secret,
        hasNextAuthUrl: !!nextAuthUrl,
        nextAuthUrl,
        redirectUri: redirect_uri,
        clientIdLength: client_id?.length,
        clientSecretLength: client_secret?.length
      },
      session: {
        hasSession: !!session,
        userEmail: session.user.email
      },
      oauthUrl: {
        base: 'https://login.upstox.com/index/dialog/authorize',
        fullUrl: `https://login.upstox.com/index/dialog/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&state=${encodeURIComponent(session.user.email)}`
      }
    };

    console.log('Upstox diagnostics result:', diagnostics);
    
    return NextResponse.json({
      success: true,
      diagnostics
    });
  } catch (error) {
    console.error('Upstox diagnostics error:', error);
    return NextResponse.json({ error: 'Diagnostics failed' }, { status: 500 });
  }
} 