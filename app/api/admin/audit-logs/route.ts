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

    // Get audit logs
    const logs = await prisma.auditLog.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 500 // Limit to recent 500 logs
    })

    // Manually fetch user data for logs that have userId
    const logsWithUsers = await Promise.all(
      logs.map(async (log) => {
        if (log.userId) {
          const user = await prisma.user.findUnique({
            where: { id: log.userId },
            select: { name: true, email: true }
          })
          return { ...log, user }
        }
        return log
      })
    )

    return NextResponse.json({ logs: logsWithUsers })
  } catch (error) {
    console.error('Admin audit logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 