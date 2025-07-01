import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { TradingPlatformFactory } from '../../../lib/trading-platforms/factory';
import { corsHeaders } from '../../../lib/middleware';

export async function GET(request: any) {
  console.log('TEST API ROUTE HIT!');
  return new Response(JSON.stringify({ test: true }), { status: 200 });
} 