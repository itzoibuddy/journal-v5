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

    // For ICICI Direct, we'll redirect to a form page since they don't have OAuth
    // Instead, we'll use their API with user credentials
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/trading-platforms/icici-direct-setup`);
  } catch (error) {
    console.error('Error redirecting to ICICI Direct setup:', error);
    return NextResponse.json(
      { error: 'Failed to redirect to ICICI Direct setup' },
      { status: 500 }
    );
  }
} 