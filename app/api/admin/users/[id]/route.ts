import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth/[...nextauth]/route'
import { prisma } from '../../../../lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the current user to check role
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the specific user with detailed information
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            trades: true
          }
        },
        trades: {
          select: {
            id: true,
            symbol: true,
            quantity: true,
            entryPrice: true,
            exitPrice: true,
            entryDate: true,
            exitDate: true,
            profitLoss: true,
            isDemo: true,
            type: true,
            strategy: true
          },
          orderBy: {
            entryDate: 'desc'
          },
          take: 20 // Get latest 20 trades
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Calculate user statistics
    const totalTrades = user.trades.length
    const completedTrades = user.trades.filter(t => t.exitDate && t.profitLoss !== null)
    const winningTrades = completedTrades.filter(t => t.profitLoss! > 0)
    const totalPnL = completedTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0)
    const winRate = completedTrades.length > 0 
      ? (winningTrades.length / completedTrades.length) * 100 
      : 0

    const userWithStats = {
      ...user,
      stats: {
        totalTrades,
        completedTrades: completedTrades.length,
        winningTrades: winningTrades.length,
        totalPnL,
        winRate
      }
    }

    return NextResponse.json({ user: userWithStats })
  } catch (error) {
    console.error('Get user details error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 