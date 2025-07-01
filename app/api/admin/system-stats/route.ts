import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '../../../lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

    // Get system statistics
    const totalUsers = await prisma.user.count()
    const totalTrades = await prisma.trade.count()
    
    // Calculate approximate storage (mock data)
    const storageUsed = `${Math.round((totalUsers * 0.1 + totalTrades * 0.05) * 100) / 100} MB`
    
    // Mock uptime calculation
    const uptime = `${Math.floor(Math.random() * 30) + 1} days`
    
    // Get last audit log as proxy for last activity
    const lastActivity = await prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' }
    })
    
    const lastBackup = lastActivity 
      ? new Date(lastActivity.createdAt).toLocaleDateString()
      : 'Never'

    const stats = {
      totalUsers,
      totalTrades,
      storageUsed,
      uptime,
      lastBackup
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Admin system stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 