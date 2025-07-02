import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const client_id = process.env.ZERODHA_CLIENT_ID;
    const redirect_uri = encodeURIComponent(process.env.ZERODHA_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/zerodha/callback`);
    
    if (!client_id) {
      return NextResponse.json(
        { 
          error: 'Zerodha integration not configured',
          message: 'To use Zerodha integration, you need to configure the following environment variables:',
          required: [
            'ZERODHA_CLIENT_ID - Your Zerodha API Key',
            'ZERODHA_CLIENT_SECRET - Your Zerodha API Secret'
          ],
          instructions: [
            '1. Go to https://kite.trade/connect/apps',
            '2. Create a new app or use an existing one',
            '3. Copy the API Key and API Secret',
            '4. Add them to your .env file',
            '5. Restart your application'
          ]
        },
        { status: 500 }
      );
    }

    const url = `https://kite.trade/connect/login?api_key=${client_id}&v=3&redirect_uri=${redirect_uri}`;
    
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('Error redirecting to Zerodha OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to redirect to Zerodha' },
      { status: 500 }
    );
  }
} 