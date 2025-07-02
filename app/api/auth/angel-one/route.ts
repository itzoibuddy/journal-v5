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

    // For Angel One, we'll redirect to a simplified OAuth-style setup page
    // This will look like OAuth but use Angel One's SmartAPI authentication
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/trading-platforms/angel-one-oauth`);
  } catch (error) {
    console.error('Error redirecting to Angel One OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to redirect to Angel One' },
      { status: 500 }
    );
  }
} 