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

    const client_id = process.env.DHAN_CLIENT_ID;
    const redirect_uri = encodeURIComponent(process.env.DHAN_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/dhan/callback`);
    const scope = encodeURIComponent('read'); // Adjust scopes as needed
    
    if (!client_id) {
      return NextResponse.json(
        { error: 'Dhan client ID not configured' },
        { status: 500 }
      );
    }

    const url = `https://api.dhan.co/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=code&scope=${scope}&state=${session.user.email}`;
    
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('Error redirecting to Dhan OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to redirect to Dhan' },
      { status: 500 }
    );
  }
} 