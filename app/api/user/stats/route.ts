import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '../../../lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get trade statistics
    const trades = await prisma.trade.findMany({
      where: { userId: user.id }
    })

    const totalTrades = trades.length
    const completedTrades = trades.filter(t => t.exitDate && t.profitLoss !== null)
    const winningTrades = completedTrades.filter(t => t.profitLoss! > 0)
    const losingTrades = completedTrades.filter(t => t.profitLoss! < 0)
    const totalPL = completedTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0)
    const winRate = completedTrades.length > 0 
      ? (winningTrades.length / completedTrades.length) * 100 
      : 0
    const profitFactor = Math.abs(completedTrades.reduce((sum, t) => sum + (t.profitLoss! > 0 ? t.profitLoss! : 0), 0)) /
      (Math.abs(completedTrades.reduce((sum, t) => sum + (t.profitLoss! < 0 ? t.profitLoss! : 0), 0)) || 1)
    const avgTrade = completedTrades.length > 0 ? totalPL / completedTrades.length : 0
    const bestTrade = completedTrades.length > 0 ? Math.max(...completedTrades.map(t => t.profitLoss!)) : 0
    const worstTrade = completedTrades.length > 0 ? Math.min(...completedTrades.map(t => t.profitLoss!)) : 0
    const openTrades = trades.filter(t => !t.exitDate).length
    const closedTrades = trades.filter(t => t.exitDate).length
    const syncedTrades = trades.filter(t => (t as any).isSynced === true).length
    const lastSyncTime = trades.reduce((latest, t) => {
      const syncAt = (t as any).lastSyncAt ? new Date((t as any).lastSyncAt) : null
      if (syncAt && (!latest || syncAt > latest)) return syncAt
      return latest
    }, null as Date | null)

    return NextResponse.json({
      totalTrades,
      totalPL,
      winRate,
      profitFactor,
      avgTrade,
      bestTrade,
      worstTrade,
      openTrades,
      closedTrades,
      syncedTrades,
      lastSyncTime
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 