import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../auth/[...nextauth]/route'
import { prisma } from '../../../../../lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export const runtime = 'nodejs'

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is admin
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!adminUser || (adminUser.role !== 'ADMIN' && adminUser.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const userId = params.id
    const body = await request.json()
    const { newPassword } = resetPasswordSchema.parse(body)

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    // Log the password reset action
    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'ADMIN_PASSWORD_RESET',
        resource: 'User',
        resourceId: userId,
        metadata: JSON.stringify({ 
          adminId: adminUser.id,
          adminEmail: adminUser.email,
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          timestamp: new Date().toISOString()
        })
      }
    })

    return NextResponse.json({ 
      message: 'Password reset successfully',
      userId: userId 
    })

  } catch (error) {
    console.error('Admin password reset error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 